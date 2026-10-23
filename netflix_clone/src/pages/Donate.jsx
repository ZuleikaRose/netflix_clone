import { Suspense, lazy, useState } from 'react'
import { MonthlyDonation } from '../components/MonthlyDonation.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { NETWORK_MESSAGE, donationsAvailable } from '../data/donations.js'
import { useMonthlyDonation } from '../state/useMonthlyDonation.js'
import { useT } from '../state/useT.js'
import { DonationHistory } from './donate/DonationHistory.jsx'

// Shown if the form's chunk can't be downloaded (offline, or a new deploy replaced the file), instead of a blank app
function DonateFormUnavailable() {
  const t = useT()
  return (
    <section className="settings-card" aria-labelledby="donate-load-heading">
      <h2 id="donate-load-heading">{t('The payment form didn’t load')}</h2>
      <p role="alert" className="form-alert">{t(NETWORK_MESSAGE)}</p>
      <button type="button" className="ghost-cta" onClick={() => window.location.reload()}>{t('Try again')}</button>
    </section>
  )
}

// The Stripe form is its own chunk, loaded only when donations are available (Supabase + a publishable key)
const DonateForm = lazy(() => import('./donate/DonateForm.jsx').catch(() => ({ default: DonateFormUnavailable })))

// /donate: a one-time or monthly card donation through Stripe (signed-in members), the member's monthly donation (to
// cancel) and their past donations. See data/donations.js.
export function Donate() {
  // Counts successful donations, so the history looks for the new row
  const t = useT()
  const [donated, setDonated] = useState(0)
  const monthly = useMonthlyDonation(donated)
  return (
    <>
      <PageHeader title={t('Make a donation')} back />
      <div className="settings donate">
        <p className="muted donate-intro">
          {t('Enjoying the app? A donation helps keep it running. Give once, or every month until you cancel; pay securely by card.')}
        </p>
        {donationsAvailable
          ? (
            <>
              <MonthlyDonation state={monthly} />
              <Suspense fallback={<p className="muted" role="status">{t('Loading the secure payment form…')}</p>}>
                <DonateForm onDonated={() => setDonated((n) => n + 1)} hasMonthly={Boolean(monthly.monthly)} />
              </Suspense>
              <DonationHistory donated={donated} />
            </>
          )
          : (
            <section className="settings-card" aria-labelledby="donate-unavailable-heading">
              <h2 id="donate-unavailable-heading">{t('Donations aren’t available here')}</h2>
              <p className="muted">{t('Donations aren’t available in this version of the app. No payment details are asked for or stored.')}</p>
            </section>
          )}
      </div>
    </>
  )
}
