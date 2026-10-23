import { locale, tr } from '../i18n/index.js'
import { authBackend } from '../lib/supabaseConfig.js'

// Donations (/donate): one-time ones through the process-donation Edge Function (a Stripe PaymentIntent) and monthly
// ones through monthly-donation (a Stripe subscription, whose first invoice has a PaymentIntent). Either returns a
// client_secret that Stripe.js confirms with the card, so card numbers never reach this app or the functions.

// Only the publishable key (pk_…) belongs here: every VITE_ value reaches the browser
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null

// Donations need a real member (Supabase Auth) and Stripe; the in-memory build shows a notice instead
export const donationsAvailable = authBackend === 'supabase' && Boolean(STRIPE_PUBLISHABLE_KEY)

export const DONATION_AMOUNTS = [5, 10, 25, 50] // dollars
export const DEFAULT_AMOUNT = '10'
export const MIN_CENTS = 100 // $1: Stripe won't charge less than $0.50 in USD
export const MAX_CENTS = 1000000 // $10,000, as the function and the donations table allow

// One formatter per interface locale (locale() is read when formatting, so it follows the language menu)
const usdFormats = new Map()
const usd = () => {
  const code = locale()
  if (!usdFormats.has(code)) usdFormats.set(code, new Intl.NumberFormat(code, { style: 'currency', currency: 'USD' }))
  return usdFormats.get(code)
}
export const formatUsd = (cents) => usd().format(cents / 100)

// "25", "$25", "1,000.5", "12.34" → integer cents, parsed from the digits (no floating-point maths); null if invalid
export function dollarsToCents(text) {
  const clean = String(text).trim().replace(/^\$/, '').replace(/,/g, '')
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// The chosen amount in cents, or a message for the "Other amount" field
export function readAmount(choice, other) {
  if (choice !== 'other') return { cents: Number(choice) * 100 }
  if (!String(other).trim()) return { problem: tr('Enter an amount.') }
  const cents = dollarsToCents(other)
  if (cents == null) return { problem: tr('Enter an amount in dollars, like 15 or 12.50.') }
  if (cents < MIN_CENTS || cents > MAX_CENTS) return { problem: tr('Choose an amount between {min} and {max}.', { min: formatUsd(MIN_CENTS), max: formatUsd(MAX_CENTS) }) }
  return { cents }
}

export const NETWORK_MESSAGE = 'Something went wrong. Please check your connection and try again.'
export const GENERIC_PAYMENT_MESSAGE = 'Your payment couldn’t be completed. Please try again.'
export const DECLINED_MESSAGE = 'Your card was declined. Please try a different card.'

// The card field's own validation (the CardElement's change event / a validation_error), in our words (in the
// interface language)
export function cardFieldMessage(error) {
  switch (error?.code) {
    case 'incomplete_number':
    case 'invalid_number': return tr('Enter a valid card number.')
    case 'incomplete_expiry':
    case 'invalid_expiry_month':
    case 'invalid_expiry_year':
    case 'invalid_expiry_month_past':
    case 'invalid_expiry_year_past': return tr('Enter a valid expiry date.')
    case 'incomplete_cvc':
    case 'invalid_cvc': return tr('Enter the card’s security code.')
    case 'incomplete_zip': return tr('Enter your ZIP code.')
    default: return tr('Check your card details.')
  }
}

// A Stripe.js error from confirmCardPayment → { network } or { message } for members. Never shows Stripe's codes,
// decline codes or raw message text. Messages are in the interface language.
export function paymentError(error) {
  if (error?.type === 'api_connection_error') return { network: true, message: tr(NETWORK_MESSAGE) }
  if (error?.type === 'validation_error') return { message: cardFieldMessage(error) }
  switch (error?.code) {
    case 'card_declined': return { message: tr(DECLINED_MESSAGE) }
    case 'expired_card': return { message: tr('Your card has expired. Please use a different card.') }
    case 'incorrect_cvc':
    case 'invalid_cvc': return { message: tr('The security code is incorrect. Please check it and try again.') }
    case 'incorrect_number':
    case 'invalid_number': return { message: tr('The card number is incorrect. Please check it and try again.') }
    case 'incorrect_zip': return { message: tr('The ZIP code doesn’t match your card. Please check it and try again.') }
    case 'processing_error': return { message: tr('We couldn’t process your card just now. Please try again in a moment.') }
    case 'payment_intent_authentication_failure':
    case 'setup_intent_authentication_failure': return { message: tr('Your card couldn’t be verified. Please try again or use a different card.') }
    default: return { message: tr(error?.decline_code ? DECLINED_MESSAGE : GENERIC_PAYMENT_MESSAGE) }
  }
}

// The member's donations, newest first (RLS: only their own rows). Recorded by the stripe-webhook function once Stripe
// reports the outcome, so a donation can take a few seconds to appear.
export const DONATION_HISTORY_LIMIT = 20
export async function loadDonations(supabase) {
  const { data, error } = await supabase.from('donations').select('id, amount, status, created_at, monthly_donation_id')
    .order('created_at', { ascending: false }).limit(DONATION_HISTORY_LIMIT)
  if (error) throw error
  return data.map((d) => ({
    id: d.id, cents: d.amount, status: d.status, createdAt: new Date(d.created_at), monthly: Boolean(d.monthly_donation_id),
  }))
}
// The webhook records a donation (and starts a monthly one) a moment after Stripe confirms it: look again after these
// delays (ms)
export const RECHECK_AFTER_MS = [2000, 5000, 10000]

// Monthly donations (migration ..._monthly_donations): the monthly-donation Edge Function starts and cancels a Stripe
// subscription; stripe-webhook marks it active once a payment goes through. The member's running one, or null.
export async function loadMonthlyDonation(supabase) {
  const { data, error } = await supabase.from('monthly_donations').select('id, amount, status, current_period_end')
    .in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data && {
    id: data.id, cents: data.amount, status: data.status,
    nextPayment: data.current_period_end ? new Date(data.current_period_end) : null,
  }
}
export const DONATION_FREQUENCIES = [
  { value: 'once', label: 'One time' },
  { value: 'monthly', label: 'Monthly' },
]

export const formatDonationDate = (date) => date.toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })

// Stripe emails the receipt; demo accounts have made-up addresses, so they get none
export const receiptEmailFor = (user) => (user.isDemo ? null : user.email)
