import { useEffect, useRef, useState } from 'react'
import { formatDonationDate, formatUsd } from '../data/donations.js'
import { useAuth } from '../state/authContext.js'

// "Your monthly donation" on /donate and in Account: the amount, the next payment and Cancel (asked twice). `state` is
// useMonthlyDonation()'s result, so the page that shows this can also hide the Monthly choice.
export function MonthlyDonation({ state }) {
  const { monthly, cancel } = state
  const { user } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stopped, setStopped] = useState(false)
  const statusRef = useRef(null)

  useEffect(() => {
    if (stopped) statusRef.current?.focus()
  }, [stopped])

  if (!monthly && !stopped) return null

  const stop = async () => {
    setBusy(true)
    const problem = await cancel()
    setBusy(false)
    setError(problem)
    if (!problem) {
      setConfirming(false)
      setStopped(true)
    }
  }

  return (
    <section className="settings-card monthly-donation" aria-labelledby="monthly-donation-heading">
      <h2 id="monthly-donation-heading">Your monthly donation</h2>
      {stopped && !monthly
        ? <p role="status" ref={statusRef} tabIndex={-1}>Your monthly donation is cancelled. No more payments will be taken.</p>
        : (
          <>
            <p>
              You give <b>{formatUsd(monthly.cents)}</b> a month.
              {/* A demo account's doesn't renew */}
              {monthly.nextPayment && !user.isDemo && ` Next payment: ${formatDonationDate(monthly.nextPayment)}.`}
            </p>
            {user.isDemo && <p className="muted">Demo accounts give once this way: it won’t renew next month.</p>}
            {monthly.status === 'past_due' && (
              <p className="form-alert">Your last payment didn’t go through. Stripe will try your card again over the next few days.</p>
            )}
            {confirming
              ? (
                <div className="monthly-confirm" role="group" aria-labelledby="monthly-confirm-text">
                  <p id="monthly-confirm-text">Stop your monthly donation? Payments already made aren’t refunded.</p>
                  <div className="report-actions">
                    <button type="button" className="cta delete-fill" onClick={stop} disabled={busy}>Yes, stop it</button>
                    <button type="button" className="ghost-cta" onClick={() => { setConfirming(false); setError(null) }}>Keep it</button>
                  </div>
                </div>
              )
              : <button type="button" className="ghost-cta" onClick={() => setConfirming(true)}>Cancel monthly donation</button>}
            {error && <p className="form-alert" role="alert">{error}</p>}
          </>
        )}
    </section>
  )
}
