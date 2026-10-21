import { use, useEffect, useRef, useState } from 'react'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { Field } from '../../components/Field.jsx'
import { callFunction } from '../../data/accountApi.js'
import { DEFAULT_AMOUNT, DONATION_AMOUNTS, NETWORK_MESSAGE, cardFieldMessage, formatUsd, paymentError, readAmount } from '../../data/donations.js'
import { getSupabase } from '../../lib/supabaseConfig.js'
import { forgetStripe, getStripe } from '../../lib/stripe.js'
import { useAuth } from '../../state/authContext.js'
import { focusFirstError } from '../formUtils.js'

// The card field lives in Stripe's iframe, so it can't read the page's CSS: these mirror index.css (.field input)
const cardStyle = {
  base: {
    color: '#f5f5f5',
    iconColor: '#bcbcbc',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: '16px',
    fontSmoothing: 'antialiased',
    '::placeholder': { color: '#8c8c8c' },
  },
  invalid: { color: '#e87c03', iconColor: '#e87c03' },
}
const elementsOptions = { fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap' }], locale: 'en' }

// Lazy-loaded by pages/Donate.jsx only when donations are available, so Stripe stays out of the main bundle and the
// in-memory build never loads Stripe.js
export default function DonateForm() {
  // getStripe() is memoised, so `use` sees the same promise on every render
  const stripe = use(getStripe())
  const [, retry] = useState(0)
  if (!stripe) {
    return (
      <section className="settings-card" aria-labelledby="donate-load-heading">
        <h2 id="donate-load-heading">The payment form didn’t load</h2>
        <p role="alert" className="form-alert">{NETWORK_MESSAGE}</p>
        <button type="button" className="ghost-cta" onClick={() => { forgetStripe(); retry((n) => n + 1) }}>Try again</button>
      </section>
    )
  }
  return <Elements stripe={stripe} options={elementsOptions}><DonationForm /></Elements>
}

function DonationForm() {
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [choice, setChoice] = useState(DEFAULT_AMOUNT)
  const [other, setOther] = useState('')
  const [errors, setErrors] = useState({}) // { amount, card }
  const [card, setCard] = useState({ complete: false, error: null })
  const [processing, setProcessing] = useState(false)
  // null while filling in; { kind: 'succeeded' | 'failed' | 'network', message?, cents }
  const [outcome, setOutcome] = useState(null)
  const resultHeading = useRef(null)
  const formRef = useRef(null)

  // Move focus to the outcome's heading so keyboard and screen-reader users land on it
  useEffect(() => {
    if (outcome) resultHeading.current?.focus()
  }, [outcome])

  const amount = readAmount(choice, other)
  const buttonLabel = amount.cents ? `Donate ${formatUsd(amount.cents)}` : 'Donate'

  // A Stripe.js error or result → the outcome. A connection failure keeps the PaymentIntent's client_secret, so
  // "Try again" carries on with the same intent instead of asking for a second one (which could charge twice).
  const outcomeOf = (cents, clientSecret, { error, paymentIntent }) => {
    if (error) {
      const { network, message } = paymentError(error)
      return network ? { kind: 'network', cents, clientSecret } : { kind: 'failed', message, cents }
    }
    if (paymentIntent?.status === 'succeeded') return { kind: 'succeeded', cents }
    return { kind: 'failed', message: paymentError(null).message, cents }
  }
  const confirm = (clientSecret) => stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: elements.getElement(CardElement) },
  })

  // `clientSecret`: the intent of an earlier attempt whose confirmation never got an answer
  const donate = async (cents, clientSecret = null) => {
    setProcessing(true)
    setOutcome(null)
    let secret = clientSecret
    let result
    try {
      if (secret) {
        // Did the earlier confirmation go through after all? Only confirm again if it's still waiting for a card.
        const { error, paymentIntent } = await stripe.retrievePaymentIntent(secret)
        if (error) result = outcomeOf(cents, secret, { error })
        else if (paymentIntent.status === 'succeeded') result = { kind: 'succeeded', cents }
        else if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
          result = outcomeOf(cents, secret, await confirm(secret))
        } else result = { kind: 'failed', message: paymentError(null).message, cents }
      } else {
        const { data, error, network } = await callFunction(await getSupabase(), 'process-donation', { amount: cents, user_id: user.id })
        if (network) result = { kind: 'network', cents }
        else if (error) result = { kind: 'failed', message: error, cents }
        else {
          secret = data.client_secret
          result = outcomeOf(cents, secret, await confirm(secret))
        }
      }
    } catch {
      // The Supabase client couldn't load, or Stripe.js threw: a connection problem (keeping any intent for the retry)
      result = { kind: 'network', cents, clientSecret: secret }
    }
    setProcessing(false)
    setOutcome(result)
  }

  const submit = (e) => {
    e.preventDefault()
    if (processing) return
    const next = {
      amount: amount.problem ?? null,
      card: card.complete ? null : cardFieldMessage(card.error ?? { code: 'incomplete_number' }),
    }
    setErrors(next)
    if (next.amount) return focusFirstError(e.currentTarget)
    if (next.card) return elements.getElement(CardElement)?.focus()
    // After an unanswered confirmation, the same amount carries on with that intent rather than starting a second one
    const pending = outcome?.kind === 'network' && outcome.cents === amount.cents ? outcome.clientSecret : null
    donate(amount.cents, pending)
  }

  const startOver = () => {
    elements.getElement(CardElement)?.clear()
    setChoice(DEFAULT_AMOUNT)
    setOther('')
    setErrors({})
    setOutcome(null)
    requestAnimationFrame(() => formRef.current?.querySelector('input[name="donation-amount"]:checked')?.focus())
  }

  if (outcome?.kind === 'succeeded') {
    return (
      <section className="settings-card donate-result" aria-labelledby="donate-result-heading">
        <div role="status">
          <h2 id="donate-result-heading" ref={resultHeading} tabIndex={-1}>Thank you for your {formatUsd(outcome.cents)} donation</h2>
          <p className="muted">Your payment went through. A receipt will appear on your card statement.</p>
        </div>
        <button type="button" className="cta" onClick={startOver}>Make another donation</button>
      </section>
    )
  }

  return (
    <form ref={formRef} className="settings-card donate-form" onSubmit={submit} noValidate aria-labelledby="donate-form-heading" aria-busy={processing}>
      <h2 id="donate-form-heading">Your donation</h2>

      <fieldset className="choice-group" disabled={processing}>
        <legend>Amount</legend>
        <div className="choice-options">
          {DONATION_AMOUNTS.map((dollars) => (
            <label key={dollars} className="choice">
              <input type="radio" name="donation-amount" value={String(dollars)} checked={choice === String(dollars)}
                onChange={(e) => { const { value } = e.target; setChoice(value) }} />
              <span>{formatUsd(dollars * 100).replace('.00', '')}</span>
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="donation-amount" value="other" checked={choice === 'other'}
              onChange={(e) => { const { value } = e.target; setChoice(value) }} />
            <span>Other amount</span>
          </label>
        </div>
      </fieldset>

      {choice === 'other' && (
        <Field label="Other amount (US dollars)" inputMode="decimal" autoComplete="off" value={other} disabled={processing}
          error={errors.amount} hint="From $1 to $10,000, up to two decimal places."
          onChange={(e) => { const { value } = e.target; setOther(value) }} />
      )}

      <div className={errors.card ? 'field has-error' : 'field'} role="group" aria-labelledby="donate-card-label">
        <p id="donate-card-label" className="donate-card-label">Card details</p>
        <CardElement className="card-input" options={{ style: cardStyle, disabled: processing, disableLink: true }}
          onChange={(e) => { setCard({ complete: e.complete, error: e.error ?? null }); if (e.complete) setErrors((x) => ({ ...x, card: null })) }} />
        {errors.card
          ? <p className="field-error"><span aria-hidden="true">⚠</span> {errors.card}</p>
          : <p className="field-hint">Card payments are handled by Stripe. We never see or store your card number.</p>}
      </div>

      {outcome && (
        <div className="donate-problem" role="alert">
          <h3 ref={resultHeading} tabIndex={-1}>{outcome.kind === 'network' ? 'We couldn’t reach the payment service' : 'Your donation didn’t go through'}</h3>
          <p>{outcome.kind === 'network' ? NETWORK_MESSAGE : outcome.message}</p>
          {outcome.kind === 'network' && (
            <button type="button" className="ghost-cta" onClick={() => donate(outcome.cents, outcome.clientSecret)} disabled={processing}>Try again</button>
          )}
        </div>
      )}

      <button type="submit" className="cta" disabled={processing || !stripe}>{processing ? 'Processing…' : buttonLabel}</button>
      {processing && <p className="muted" role="status">Processing your donation…</p>}
    </form>
  )
}
