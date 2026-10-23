// POST /functions/v1/monthly-donation (signed in)
//   { action: 'start', amount, user_id } → { client_secret } for the first payment
//   { action: 'cancel' } → { canceled: true }
// Monthly donations are Stripe subscriptions for `amount` cents a month (USD, cards only). Starting one creates (or
// reuses) the member's Stripe customer and a subscription whose first invoice the app pays with Stripe.js
// (confirmCardPayment with that invoice's client_secret), so card numbers never reach this function. The row in
// public.monthly_donations starts 'incomplete'; stripe-webhook makes it 'active' once a payment goes through and
// records each month's payment in public.donations. Cancelling stops future payments at once (nothing is refunded).
// A member has at most one live monthly donation; an unpaid one is replaced when they start again. A demo account's
// is a single payment that doesn't renew (the account is deleted after 24 hours), and delete-account stops a member's,
// so no closed account goes on being charged. Needs the STRIPE_SECRET_KEY function variable, like process-donation.
import Stripe from 'npm:stripe@23.0.0'
import { admin, allowRequest, callerFrom, clientIp, json, serve } from '../_shared/supabase.ts'

const MIN_AMOUNT = 100 // $1.00, as on /donate
const MAX_AMOUNT = 1000000 // $10,000.00, as in the monthly_donations table's check
const PER_MEMBER_PER_HOUR = 20
const PER_IP_PER_HOUR = 60
// The Stripe product every monthly donation's price belongs to; created the first time it's needed
const PRODUCT_ID = 'netflix_clone_monthly_donation'
const DONATION_SOURCE = 'netflix-clone-donation' // stripe-webhook only records payments carrying this

const apiKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripe = apiKey
  ? new Stripe(apiKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 })
  : null

type MonthlyRow = { id: string, status: string, stripe_customer_id: string, stripe_subscription_id: string }

async function ensureProduct(client: Stripe) {
  try {
    await client.products.retrieve(PRODUCT_ID)
  } catch (error) {
    if ((error as { code?: string }).code !== 'resource_missing') throw error
    await client.products.create({ id: PRODUCT_ID, name: 'Monthly donation' })
  }
}

// The member's live monthly donation (incomplete, active or past due), if any, and any Stripe customer they already have
async function memberRows(userId: string) {
  const { data, error } = await admin.from('monthly_donations')
    .select('id, status, stripe_customer_id, stripe_subscription_id').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  const rows = (data ?? []) as MonthlyRow[]
  return { live: rows.find((r) => r.status !== 'canceled') ?? null, customerId: rows[0]?.stripe_customer_id ?? null }
}

async function cancelRow(client: Stripe, row: MonthlyRow) {
  try {
    await client.subscriptions.cancel(row.stripe_subscription_id)
  } catch (error) {
    // Already cancelled (or expired unpaid) in Stripe: only our row is out of date
    if ((error as { code?: string }).code !== 'resource_missing') throw error
  }
  const { error } = await admin.from('monthly_donations').update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', row.id)
  if (error) throw error
}

serve(async (req, body) => {
  const caller = await callerFrom(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const user = caller.user
  if (!stripe) return json({ error: 'Donations are not available right now.' }, 503)
  if (!(await allowRequest(`donation:user:${user.id}`, PER_MEMBER_PER_HOUR, 3600))
    || !(await allowRequest(`donation:ip:${clientIp(req)}`, PER_IP_PER_HOUR, 3600))) {
    return json({ error: 'You’ve tried to donate several times this hour. Please try again later.' }, 429)
  }

  if (body.action === 'cancel') {
    try {
      const { live } = await memberRows(user.id)
      if (!live) return json({ error: 'You don’t have a monthly donation.' }, 404)
      await cancelRow(stripe, live)
      return json({ canceled: true })
    } catch (error) {
      console.error('monthly-donation: cancelling failed', error)
      return json({ error: 'Your monthly donation couldn’t be cancelled. Please try again.' }, 502)
    }
  }

  if (body.action !== 'start') return json({ error: 'Unknown action.' }, 400)
  const { amount } = body
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json({ error: 'Choose an amount between $1 and $10,000.' }, 400)
  }
  if (body.user_id !== user.id) return json({ error: 'You can only donate from your own account.' }, 403)

  // Demo accounts (app_metadata.demo) have made-up addresses: no email, so no receipts. Their subscription takes the
  // first payment and doesn't renew. (Ending it sooner with cancel_at would shorten the first period instead, and
  // Stripe would charge nothing at all.)
  const demo = user.app_metadata?.demo === true
  const email = demo ? undefined : user.email

  try {
    const { live, customerId } = await memberRows(user.id)
    if (live && live.status !== 'incomplete') {
      return json({ error: 'You already give every month. Cancel that donation first to change the amount.' }, 409)
    }
    // An earlier start whose first payment never went through
    if (live) await cancelRow(stripe, live)

    const customer = customerId ?? (await stripe.customers.create({ ...(email ? { email } : {}), metadata: { user_id: user.id } })).id
    await ensureProduct(stripe)
    const subscription = await stripe.subscriptions.create({
      customer,
      items: [{ price_data: { currency: 'usd', product: PRODUCT_ID, unit_amount: amount, recurring: { interval: 'month' } } }],
      payment_behavior: 'default_incomplete',
      payment_settings: { payment_method_types: ['card'], save_default_payment_method: 'on_subscription' },
      metadata: { user_id: user.id, source: DONATION_SOURCE },
      ...(demo ? { cancel_at_period_end: true } : {}),
      expand: ['latest_invoice.confirmation_secret'],
    })
    const invoice = subscription.latest_invoice as Stripe.Invoice | null
    const clientSecret = invoice?.confirmation_secret?.client_secret
    const { error } = clientSecret
      ? await admin.from('monthly_donations').insert({
        user_id: user.id, amount, stripe_customer_id: customer, stripe_subscription_id: subscription.id, status: 'incomplete',
      })
      : { error: new Error(`Subscription ${subscription.id} has no first payment to confirm`) }
    if (error) {
      // Don't leave a subscription the database doesn't know about
      await stripe.subscriptions.cancel(subscription.id).catch(() => {})
      throw error
    }
    return json({ client_secret: clientSecret })
  } catch (error) {
    console.error('monthly-donation: starting failed', error)
    return json({ error: 'The payment service isn’t responding. Please try again later.' }, 502)
  }
})
