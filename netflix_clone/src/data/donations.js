import { authBackend } from '../lib/supabaseConfig.js'

// One-time donations (/donate): the process-donation Edge Function creates a Stripe PaymentIntent and returns its
// client_secret; Stripe.js confirms it with the card, so card numbers never reach this app or the function.

// Only the publishable key (pk_…) belongs here: every VITE_ value reaches the browser
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null

// Donations need a real member (Supabase Auth) and Stripe; the in-memory build shows a notice instead
export const donationsAvailable = authBackend === 'supabase' && Boolean(STRIPE_PUBLISHABLE_KEY)

export const DONATION_AMOUNTS = [5, 10, 25, 50] // dollars
export const DEFAULT_AMOUNT = '10'
export const MIN_CENTS = 100 // $1: Stripe won't charge less than $0.50 in USD
export const MAX_CENTS = 1000000 // $10,000, as the function and the donations table allow

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatUsd = (cents) => usd.format(cents / 100)

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
  if (!String(other).trim()) return { problem: 'Enter an amount.' }
  const cents = dollarsToCents(other)
  if (cents == null) return { problem: 'Enter an amount in dollars, like 15 or 12.50.' }
  if (cents < MIN_CENTS || cents > MAX_CENTS) return { problem: `Choose an amount between ${formatUsd(MIN_CENTS)} and ${formatUsd(MAX_CENTS)}.` }
  return { cents }
}

export const NETWORK_MESSAGE = 'Something went wrong. Please check your connection and try again.'
export const GENERIC_PAYMENT_MESSAGE = 'Your payment couldn’t be completed. Please try again.'
export const DECLINED_MESSAGE = 'Your card was declined. Please try a different card.'

// The card field's own validation (the CardElement's change event / a validation_error), in our words
export function cardFieldMessage(error) {
  switch (error?.code) {
    case 'incomplete_number':
    case 'invalid_number': return 'Enter a valid card number.'
    case 'incomplete_expiry':
    case 'invalid_expiry_month':
    case 'invalid_expiry_year':
    case 'invalid_expiry_month_past':
    case 'invalid_expiry_year_past': return 'Enter a valid expiry date.'
    case 'incomplete_cvc':
    case 'invalid_cvc': return 'Enter the card’s security code.'
    case 'incomplete_zip': return 'Enter your ZIP code.'
    default: return 'Check your card details.'
  }
}

// A Stripe.js error from confirmCardPayment → { network } or { message } for members. Never shows Stripe's codes,
// decline codes or raw message text.
export function paymentError(error) {
  if (error?.type === 'api_connection_error') return { network: true, message: NETWORK_MESSAGE }
  if (error?.type === 'validation_error') return { message: cardFieldMessage(error) }
  switch (error?.code) {
    case 'card_declined': return { message: DECLINED_MESSAGE }
    case 'expired_card': return { message: 'Your card has expired. Please use a different card.' }
    case 'incorrect_cvc':
    case 'invalid_cvc': return { message: 'The security code is incorrect. Please check it and try again.' }
    case 'incorrect_number':
    case 'invalid_number': return { message: 'The card number is incorrect. Please check it and try again.' }
    case 'incorrect_zip': return { message: 'The ZIP code doesn’t match your card. Please check it and try again.' }
    case 'processing_error': return { message: 'We couldn’t process your card just now. Please try again in a moment.' }
    case 'payment_intent_authentication_failure':
    case 'setup_intent_authentication_failure': return { message: 'Your card couldn’t be verified. Please try again or use a different card.' }
    default: return { message: error?.decline_code ? DECLINED_MESSAGE : GENERIC_PAYMENT_MESSAGE }
  }
}
