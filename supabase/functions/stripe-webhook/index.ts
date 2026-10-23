// POST /functions/v1/stripe-webhook (called by Stripe, not the app) → { received: true }
// Records donations in public.donations: one-time ones from payment_intent.succeeded and payment_intent.payment_failed,
// and each month's payment of a monthly donation from invoice.paid and invoice.payment_failed. It also keeps
// public.monthly_donations in step with the Stripe subscription (customer.subscription.updated and .deleted).
// Every request must carry a valid Stripe-Signature for STRIPE_WEBHOOK_SECRET (the signing value of the Stripe
// endpoint that points here), so nobody else can record a donation. Stripe may send an event more than once or out of
// order: one row per PaymentIntent, a failure can later become a success (the member retried the card), never the
// other way round; a cancelled monthly donation stays cancelled. A database error answers 500 so Stripe retries;
// anything that a retry can't fix answers 200. Looking up an invoice's payment needs STRIPE_SECRET_KEY too.
import Stripe from 'npm:stripe@23.0.0'
import { admin } from '../_shared/supabase.ts'

const signingKey = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const apiKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripe = apiKey ? new Stripe(apiKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }) : null
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const DONATION_SOURCE = 'netflix-clone-donation' // set by process-donation and monthly-donation
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const received = () => reply({ received: true })
const isoFrom = (seconds?: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null)

type Donation = { userId: string, amount: number, intentId: string, status: 'succeeded' | 'failed', monthlyId?: string }

// One row per PaymentIntent; a failure can become a success, never the reverse
async function saveDonation({ userId, amount, intentId, status, monthlyId }: Donation) {
  const { data: existing, error } = await admin.from('donations').select('status')
    .eq('stripe_payment_intent_id', intentId).maybeSingle()
  if (error) throw error

  if (!existing) {
    const { error: insertError } = await admin.from('donations')
      .insert({ user_id: userId, amount, stripe_payment_intent_id: intentId, status, monthly_donation_id: monthlyId ?? null })
    if (!insertError) return
    if (insertError.code === '23503' || insertError.code === '23514') {
      // The account is gone, or the amount is outside what a donation can be: retrying won't change that
      console.error('stripe-webhook: donation not recorded', intentId, insertError)
      return
    }
    // 23505: another delivery of an event for this PaymentIntent got there first; fall through to the upgrade
    if (insertError.code !== '23505') throw insertError
  }

  // Only ever failed → succeeded: a late failure event never downgrades a donation that went through
  if (status === 'succeeded' && existing?.status !== 'succeeded') {
    const { error: updateError } = await admin.from('donations').update({ status: 'succeeded' })
      .eq('stripe_payment_intent_id', intentId).eq('status', 'failed')
    if (updateError) throw updateError
  }
}

async function recordDonation(intent: Stripe.PaymentIntent, status: 'succeeded' | 'failed') {
  const userId = intent.metadata?.user_id
  // A payment that didn't come from process-donation (another product on the same Stripe account, or a monthly
  // donation's invoice, recorded from the invoice event instead): not for this handler
  if (intent.metadata?.source !== DONATION_SOURCE || intent.currency !== 'usd' || !userId || !UUID.test(userId)) {
    return received()
  }
  await saveDonation({ userId, amount: intent.amount, intentId: intent.id, status })
  return received()
}

const subscriptionIdOf = (subscription: string | Stripe.Subscription | null | undefined) =>
  (typeof subscription === 'string' ? subscription : subscription?.id ?? null)

// A monthly donation's payment: the invoice belongs to one of our subscriptions; its PaymentIntent is the row's key
async function recordMonthlyPayment(invoice: Stripe.Invoice, status: 'succeeded' | 'failed') {
  const details = invoice.parent?.subscription_details
  const subscriptionId = subscriptionIdOf(details?.subscription)
  if (details?.metadata?.source !== DONATION_SOURCE || !subscriptionId || invoice.currency !== 'usd') return received()

  const { data: monthly, error } = await admin.from('monthly_donations').select('id, user_id, status')
    .eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (error) throw error
  if (!monthly) {
    console.error('stripe-webhook: no monthly donation for subscription', subscriptionId)
    return received()
  }
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')

  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 10 })
  const intent = payments.data.map((p) => p.payment?.payment_intent).find(Boolean)
  const intentId = typeof intent === 'string' ? intent : intent?.id
  if (intentId) {
    await saveDonation({
      userId: monthly.user_id, amount: status === 'succeeded' ? invoice.amount_paid : invoice.amount_due, intentId, status,
      monthlyId: monthly.id,
    })
  } else {
    console.error('stripe-webhook: invoice has no PaymentIntent', invoice.id)
  }

  if (monthly.status !== 'canceled') {
    const periodEnd = isoFrom(invoice.lines?.data?.[0]?.period?.end)
    const next = status === 'succeeded'
      ? { status: 'active', ...(periodEnd ? { current_period_end: periodEnd } : {}) }
      // A failed first payment leaves it incomplete; a failed later one means Stripe is retrying
      : monthly.status === 'active' ? { status: 'past_due' } : null
    if (next) {
      const { error: updateError } = await admin.from('monthly_donations').update(next).eq('id', monthly.id).neq('status', 'canceled')
      if (updateError) throw updateError
    }
  }
  return received()
}

// Stripe's subscription status → ours ('incomplete' is where rows start, so it never moves a row back)
const statusFor: Record<string, string> = {
  active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled',
}

async function syncSubscription(subscription: Stripe.Subscription, deleted: boolean) {
  if (subscription.metadata?.source !== DONATION_SOURCE) return received()
  const status = deleted ? 'canceled' : statusFor[subscription.status]
  if (!status) return received()
  const periodEnd = isoFrom(subscription.items?.data?.[0]?.current_period_end)
  const { error } = await admin.from('monthly_donations').update({
    status,
    ...(status === 'canceled' ? { canceled_at: isoFrom(subscription.canceled_at) ?? new Date().toISOString() } : {}),
    ...(periodEnd && status !== 'canceled' ? { current_period_end: periodEnd } : {}),
  }).eq('stripe_subscription_id', subscription.id).neq('status', 'canceled')
  if (error) throw error
  return received()
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
    switch (event.type) {
      case 'payment_intent.succeeded': return await recordDonation(event.data.object, 'succeeded')
      case 'payment_intent.payment_failed': return await recordDonation(event.data.object, 'failed')
      case 'invoice.paid': return await recordMonthlyPayment(event.data.object, 'succeeded')
      case 'invoice.payment_failed': return await recordMonthlyPayment(event.data.object, 'failed')
      case 'customer.subscription.updated': return await syncSubscription(event.data.object, false)
      case 'customer.subscription.deleted': return await syncSubscription(event.data.object, true)
      default: return received()
    }
  } catch (error) {
    console.error('stripe-webhook: saving the event failed', event.id, error)
    return reply({ error: 'Could not record the event.' }, 500)
  }
})
