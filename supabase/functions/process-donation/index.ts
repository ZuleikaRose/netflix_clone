// POST /functions/v1/process-donation { amount, user_id } (signed in) → { client_secret }
// Starts a one-time donation: creates a Stripe PaymentIntent (USD, cards only) for `amount` cents, which the app
// confirms with Stripe.js (CardElement + confirmCardPayment), so card numbers never reach this function. The outcome is
// recorded in public.donations by the stripe-webhook function. user_id must be the signed-in member: the token decides
// who donates, the body only confirms it. Needs the Stripe API key in the NETFLIX_CLONE_TEST_API function variable
// (test mode on dev).
import Stripe from 'npm:stripe@23.0.0'
import { allowRequest, callerFrom, clientIp, json, serve } from '../_shared/supabase.ts'

const MAX_AMOUNT = 1000000 // $10,000.00, as in the donations table's check
const PER_MEMBER_PER_HOUR = 20
const PER_IP_PER_HOUR = 60

const apiKey = Deno.env.get('NETFLIX_CLONE_TEST_API')
const stripe = apiKey
  ? new Stripe(apiKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 })
  : null

serve(async (req, body) => {
  const caller = await callerFrom(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const userId = caller.user.id

  const { amount } = body
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return json({ error: 'Choose an amount between $0.01 and $10,000.' }, 400)
  }
  if (body.user_id !== userId) return json({ error: 'You can only donate from your own account.' }, 403)

  if (!stripe) return json({ error: 'Donations are not available right now.' }, 503)
  if (!(await allowRequest(`donation:user:${userId}`, PER_MEMBER_PER_HOUR, 3600))
    || !(await allowRequest(`donation:ip:${clientIp(req)}`, PER_IP_PER_HOUR, 3600))) {
    return json({ error: 'You’ve tried to donate several times this hour. Please try again later.' }, 429)
  }

  try {
    // maxNetworkRetries makes the SDK send an idempotency key, so a retried request can't create a second intent
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      allowed_payment_method_types: ['card'], // stripe-node 23 renamed payment_method_types
      description: 'Donation',
      metadata: { user_id: userId, source: 'netflix-clone-donation' },
    })
    if (!intent.client_secret) throw new Error(`PaymentIntent ${intent.id} has no client_secret`)
    return json({ client_secret: intent.client_secret })
  } catch (error) {
    console.error('process-donation: Stripe refused the PaymentIntent', error)
    return json({ error: 'The payment service isn’t responding. Please try again later.' }, 502)
  }
})
