import { Suspense, lazy } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { NETWORK_MESSAGE, donationsAvailable } from '../data/donations.js'

// Shown if the form's chunk can't be downloaded (offline, or a new deploy replaced the file), instead of a blank app
function DonateFormUnavailable() {
  return (
    <section className="settings-card" aria-labelledby="donate-load-heading">
      <h2 id="donate-load-heading">The payment form didn’t load</h2>
      <p role="alert" className="form-alert">{NETWORK_MESSAGE}</p>
      <button type="button" className="ghost-cta" onClick={() => window.location.reload()}>Try again</button>
    </section>
  )
}

// The Stripe form is its own chunk, loaded only when donations are available (Supabase + a publishable key)
const DonateForm = lazy(() => import('./donate/DonateForm.jsx').catch(() => ({ default: DonateFormUnavailable })))

// /donate: a one-time card donation through Stripe (signed-in members). See data/donations.js.
export function Donate() {
  return (
    <>
      <PageHeader title="Make a donation" back />
      <div className="settings donate">
        <p className="muted donate-intro">
          Enjoying the app? A one-time donation helps keep it running. Choose an amount and pay securely by card; nothing
          is charged again later.
        </p>
        {donationsAvailable
          ? (
            <Suspense fallback={<p className="muted" role="status">Loading the secure payment form…</p>}>
              <DonateForm />
            </Suspense>
          )
          : (
            <section className="settings-card" aria-labelledby="donate-unavailable-heading">
              <h2 id="donate-unavailable-heading">Donations aren’t available here</h2>
              <p className="muted">Donations aren’t available in this version of the app. No payment details are asked for or stored.</p>
            </section>
          )}
      </div>
    </>
  )
}
