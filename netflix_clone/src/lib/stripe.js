import { loadStripe } from '@stripe/stripe-js/pure'
import { STRIPE_PUBLISHABLE_KEY } from '../data/donations.js'

// Stripe.js from js.stripe.com, loaded once and only when /donate shows the payment form (the /pure entry doesn't add
// the script on import). Resolves to the Stripe object, or null if it couldn't load.
let stripePromise = null

export function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY).catch(() => null)
  return stripePromise
}

// After a failed load, "Try again" calls this so the next getStripe() loads it afresh
export function forgetStripe() {
  stripePromise = null
}
