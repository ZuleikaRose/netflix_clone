import { use, useEffect, useRef, useState } from 'react'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { Field } from '../../components/Field.jsx'
import { callFunction } from '../../data/accountApi.js'
import {
  DEFAULT_AMOUNT, DONATION_AMOUNTS, DONATION_FREQUENCIES, NETWORK_MESSAGE, cardFieldMessage, formatUsd, paymentError, readAmount, receiptEmailFor,
} from '../../data/donations.js'
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
// PaymentIntent statuses that can still be confirmed with a card
const CONFIRMABLE = ['requires_payment_method', 'requires_confirmation', 'requires_action']

// Lazy-loaded by pages/Donate.jsx only when donations are available, so Stripe stays out of the main bundle and the
// in-memory build never loads Stripe.js
// `hasMonthly`: the member already gives monthly, so only one-time donations are offered
export default function DonateForm({ onDonated, hasMonthly = false }) {
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
  return <Elements stripe={stripe} options={elementsOptions}><DonationForm onDonated={onDonated} hasMonthly={hasMonthly} /></Elements>
}

function DonationForm({ onDonated, hasMonthly }) {
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [frequency, setFrequency] = useState('once') // 'once' | 'monthly'
  const monthly = frequency === 'monthly' && !hasMonthly
  const [choice, setChoice] = useState(DEFAULT_AMOUNT)
  const [other, setOther] = useState('')
  const [errors, setErrors] = useState({}) // { amount, card }
  const [card, setCard] = useState({ complete: false, error: null })
  const [processing, setProcessing] = useState(false)
  // null while filling in; { kind: 'succeeded' | 'processing' | 'failed' | 'network', message?, cents, monthly }
  const [outcome, setOutcome] = useState(null)
  // The PaymentIntent of an earlier attempt that didn't succeed (declined, or no answer): { clientSecret, cents,
  // monthly } (a monthly donation's is its first invoice's). The next attempt asks Stripe about it before anything else,
  // so it's never paid twice or left behind for a new one.
  const [pending, setPending] = useState(null)
  const resultHeading = useRef(null)
  const formRef = useRef(null)

  // Move focus to the outcome's heading so keyboard and screen-reader users land on it
  useEffect(() => {
    if (outcome) resultHeading.current?.focus()
  }, [outcome])

  const amount = readAmount(choice, other)
  const buttonLabel = amount.cents ? `Donate ${formatUsd(amount.cents)}${monthly ? ' a month' : ''}` : 'Donate'

  // A Stripe.js error or result → the outcome. `processing` (the bank hasn't answered yet) isn't a failure: the webhook
  // records it once Stripe knows.
  const outcomeOf = (cents, { error, paymentIntent }) => {
    if (error) {
      const { network, message } = paymentError(error)
      return network ? { kind: 'network', cents } : { kind: 'failed', message, cents }
    }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') return { kind: paymentIntent.status, cents }
    return { kind: 'failed', message: paymentError(null).message, cents }
  }
  const confirm = (clientSecret) => stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: elements.getElement(CardElement) },
  })

  // `everyMonth`: start a monthly donation (monthly-donation) rather than give once (process-donation)
  const donate = async (cents, everyMonth) => {
    setProcessing(true)
    setOutcome(null)
    // The intent this attempt ends up with: the earlier one, or a new one from the function
    let intent = pending
    let result
    try {
      if (intent) {
        // Did the earlier attempt go through after all (a confirmation that got no answer)? Then that's the donation,
        // whatever amount is chosen now. Still waiting for a card: the same amount and frequency carries on with it
        // (one intent, so one row in Your donations); anything else starts afresh, as nothing was paid on the earlier one.
        const { error, paymentIntent } = await stripe.retrievePaymentIntent(intent.clientSecret)
        if (error) {
          result = outcomeOf(intent.cents, { error })
          // Stripe answered but won't say (not a lost connection): forget it, or every later try would stop here too
          if (result.kind === 'failed') intent = null
        } else if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          result = outcomeOf(intent.cents, { paymentIntent })
        } else if (intent.cents === cents && intent.monthly === everyMonth && CONFIRMABLE.includes(paymentIntent.status)) {
          result = outcomeOf(cents, await confirm(intent.clientSecret))
        } else intent = null
      }
      if (!result) {
        const [name, body] = everyMonth
          ? ['monthly-donation', { action: 'start', amount: cents, user_id: user.id }]
          : ['process-donation', { amount: cents, user_id: user.id }]
        const { data, error, network } = await callFunction(await getSupabase(), name, body)
        if (network) result = { kind: 'network', cents }
        else if (error) result = { kind: 'failed', message: error, cents }
        else if (!data?.client_secret) result = { kind: 'failed', message: paymentError(null).message, cents }
        else {
          intent = { clientSecret: data.client_secret, cents, monthly: everyMonth }
          result = outcomeOf(cents, await confirm(intent.clientSecret))
        }
      }
    } catch {
      // The Supabase client couldn't load, or Stripe.js threw: a connection problem
      result = { kind: 'network', cents }
    }
    // An earlier attempt that went through is that attempt's kind of donation
    result = { ...result, monthly: intent?.monthly ?? everyMonth }
    // Keep an intent that may still be paid; forget it once it went through (or is going through)
    const done = result.kind === 'succeeded' || result.kind === 'processing'
    setPending(done ? null : intent)
    setProcessing(false)
    setOutcome(result)
    if (done) onDonated?.()
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
    donate(amount.cents, monthly)
  }

  const startOver = () => {
    elements.getElement(CardElement)?.clear()
    setFrequency('once')
    setChoice(DEFAULT_AMOUNT)
    setOther('')
    setErrors({})
    setOutcome(null)
    requestAnimationFrame(() => formRef.current?.querySelector('input[name="donation-amount"]:checked')?.focus())
  }

  if (outcome?.kind === 'succeeded' || outcome?.kind === 'processing') {
    return (
      <section className="settings-card donate-result" aria-labelledby="donate-result-heading">
        {outcome.kind === 'succeeded' ? (
          <div role="status">
            <h2 id="donate-result-heading" ref={resultHeading} tabIndex={-1}>
              {outcome.monthly ? `Thank you for giving ${formatUsd(outcome.cents)} a month` : `Thank you for your ${formatUsd(outcome.cents)} donation`}
            </h2>
            <p className="muted">
              {outcome.monthly ? 'Your first payment went through, and the next ones follow on the same day each month until you cancel.' : 'Your payment went through.'}{' '}
              {receiptEmailFor(user) ? <>Stripe will email a receipt to <b>{receiptEmailFor(user)}</b>.</> : 'It will appear on your card statement.'}
            </p>
          </div>
        ) : (
          <div role="status">
            <h2 id="donate-result-heading" ref={resultHeading} tabIndex={-1}>
              Your {formatUsd(outcome.cents)}{outcome.monthly && ' monthly'} donation is being processed
            </h2>
            <p className="muted">
              Your bank hasn’t confirmed the payment yet. It will show under Your donations once it has, so there’s no
              need to donate again.
            </p>
          </div>
        )}
        <button type="button" className="cta" onClick={startOver}>Make another donation</button>
      </section>
    )
  }

  return (
    <form ref={formRef} className="settings-card donate-form" onSubmit={submit} noValidate aria-labelledby="donate-form-heading" aria-busy={processing}>
      <h2 id="donate-form-heading">Your donation</h2>

      {!hasMonthly && (
        <fieldset className="choice-group" disabled={processing}>
          <legend>How often</legend>
          <div className="choice-options">
            {DONATION_FREQUENCIES.map((f) => (
              <label key={f.value} className="choice">
                <input type="radio" name="donation-frequency" value={f.value} checked={frequency === f.value}
                  onChange={(e) => { const { value } = e.target; setFrequency(value) }} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
          {monthly && <p className="field-hint">Charged today and on the same day each month until you cancel, here or in Account.</p>}
        </fieldset>
      )}

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
            <button type="button" className="ghost-cta" onClick={() => donate(outcome.cents, outcome.monthly)} disabled={processing}>Try again</button>
          )}
        </div>
      )}

      <button type="submit" className="cta" disabled={processing || !stripe}>{processing ? 'Processing…' : buttonLabel}</button>
      {processing && <p className="muted" role="status">Processing your donation…</p>}
    </form>
  )
}
