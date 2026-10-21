// POST /functions/v1/stripe-webhook (called by Stripe, not the app) → { received: true }
// Records donations from payment_intent.succeeded and payment_intent.payment_failed in public.donations. Every request
// must carry a valid Stripe-Signature for STRIPE_WEBHOOK_SECRET (the signing value of the Stripe endpoint that points
// here), so nobody else can record a donation. Stripe may send an event more than once or out of order: one row per
// PaymentIntent, a failure can later become a success (the member retried the card), never the other way round.
// A database error answers 500 so Stripe retries; anything that a retry can't fix answers 200.
import Stripe from 'npm:stripe@23.0.0'
import { admin } from '../_shared/supabase.ts'

const signingKey = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const DONATION_SOURCE = 'netflix-clone-donation' // set by process-donation
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function recordDonation(intent: Stripe.PaymentIntent, status: 'succeeded' | 'failed') {
  const userId = intent.metadata?.user_id
  // A payment that didn't come from process-donation (other products on the same Stripe account): not ours to record
  if (intent.metadata?.source !== DONATION_SOURCE || intent.currency !== 'usd' || !userId || !UUID.test(userId)) {
    return reply({ received: true })
  }

  const { data: existing, error } = await admin.from('donations').select('status')
    .eq('stripe_payment_intent_id', intent.id).maybeSingle()
  if (error) throw error

  if (!existing) {
    const { error: insertError } = await admin.from('donations')
      .insert({ user_id: userId, amount: intent.amount, stripe_payment_intent_id: intent.id, status })
    if (!insertError) return reply({ received: true })
    if (insertError.code === '23503' || insertError.code === '23514') {
      // The account is gone, or the amount is outside what a donation can be: retrying won't change that
      console.error('stripe-webhook: donation not recorded', intent.id, insertError)
      return reply({ received: true })
    }
    // 23505: another delivery of an event for this PaymentIntent got there first; fall through to the upgrade
    if (insertError.code !== '23505') throw insertError
  }

  // Only ever failed → succeeded: a late failure event never downgrades a donation that went through
  if (status === 'succeeded' && existing?.status !== 'succeeded') {
    const { error: updateError } = await admin.from('donations').update({ status: 'succeeded' })
      .eq('stripe_payment_intent_id', intent.id).eq('status', 'failed')
    if (updateError) throw updateError
  }
  return reply({ received: true })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  if (!signingKey) {
    // 500, not 400: Stripe keeps retrying for days, so events aren't lost while the variable is being set
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set')
    return reply({ error: 'Webhook signing is not configured.' }, 500)
  }
  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return reply({ error: 'Missing Stripe-Signature.' }, 400)

  // The signature covers the exact bytes Stripe sent, so read the raw body rather than parsing it first
  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = await Stripe.webhooks.constructEventAsync(payload, signature, signingKey, undefined, cryptoProvider)
  } catch (error) {
    console.error('stripe-webhook: signature check failed', error instanceof Error ? error.message : error)
    return reply({ error: 'Invalid signature.' }, 400)
  }

  try {
    if (event.type === 'payment_intent.succeeded') return await recordDonation(event.data.object, 'succeeded')
    if (event.type === 'payment_intent.payment_failed') return await recordDonation(event.data.object, 'failed')
    return reply({ received: true })
  } catch (error) {
    console.error('stripe-webhook: saving the donation failed', event.id, error)
    return reply({ error: 'Could not record the event.' }, 500)
  }
})
