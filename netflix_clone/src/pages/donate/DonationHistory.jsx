import { useEffect, useState } from 'react'
import { DONATION_HISTORY_LIMIT, RECHECK_AFTER_MS, formatDonationDate, formatUsd, loadDonations } from '../../data/donations.js'
import { getSupabase } from '../../lib/supabaseConfig.js'
import { useT } from '../../state/useT.js'

// "Your donations" on /donate: amount, date and whether each went through. `donated` changes after every successful
// donation, which starts the rechecks.
export function DonationHistory({ donated }) {
  const t = useT()
  const [donations, setDonations] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false
    const refresh = () => getSupabase().then(loadDonations).then(
      (found) => { if (!ignore) { setDonations(found); setError(false) } },
      () => { if (!ignore) setError(true) },
    )
    refresh()
    const timers = donated ? RECHECK_AFTER_MS.map((ms) => setTimeout(refresh, ms)) : []
    return () => { ignore = true; timers.forEach(clearTimeout) }
  }, [donated])

  return (
    <section className="settings-card" aria-labelledby="donation-history-heading">
      <h2 id="donation-history-heading">{t('Your donations')}</h2>
      {!donations && !error && <p className="muted" role="status">{t('Loading your donations…')}</p>}
      {error && <p className="form-alert" role="alert">{t('Your donations couldn’t be loaded. Please try again later.')}</p>}
      {donations?.length === 0 && <p className="muted">{t('You haven’t made a donation yet.')}</p>}
      {donations?.length > 0 && (
        <ul className="device-list donation-list">
          {donations.map((d) => (
            <li key={d.id}>
              <span>
                <b>{formatUsd(d.cents)}</b>
                <span className="muted">{formatDonationDate(d.createdAt)}{d.monthly && ` · ${t('Monthly')}`}</span>
              </span>
              <span className={d.status === 'succeeded' ? 'donation-status' : 'donation-status failed'}>
                {d.status === 'succeeded' ? t('Paid') : t('Didn’t go through')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {donations?.length === DONATION_HISTORY_LIMIT && <p className="muted">{t('Showing your {count} most recent donations.', { count: DONATION_HISTORY_LIMIT })}</p>}
      {donated > 0 && <p className="muted">{t('A new donation can take a few seconds to appear here.')}</p>}
    </section>
  )
}
