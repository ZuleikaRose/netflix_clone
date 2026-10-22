import { useEffect, useState } from 'react'
import { DONATION_HISTORY_LIMIT, formatDonationDate, formatUsd, loadDonations } from '../../data/donations.js'
import { getSupabase } from '../../lib/supabaseConfig.js'

// The webhook records a donation a moment after Stripe confirms it: look again after these delays (ms)
const RECHECK_AFTER = [2000, 5000, 10000]

// "Your donations" on /donate: amount, date and whether each went through. `donated` changes after every successful
// donation, which starts the rechecks.
export function DonationHistory({ donated }) {
  const [donations, setDonations] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false
    const refresh = () => getSupabase().then(loadDonations).then(
      (found) => { if (!ignore) { setDonations(found); setError(false) } },
      () => { if (!ignore) setError(true) },
    )
    refresh()
    const timers = donated ? RECHECK_AFTER.map((ms) => setTimeout(refresh, ms)) : []
    return () => { ignore = true; timers.forEach(clearTimeout) }
  }, [donated])

  return (
    <section className="settings-card" aria-labelledby="donation-history-heading">
      <h2 id="donation-history-heading">Your donations</h2>
      {!donations && !error && <p className="muted" role="status">Loading your donations…</p>}
      {error && <p className="form-alert" role="alert">Your donations couldn’t be loaded. Please try again later.</p>}
      {donations?.length === 0 && <p className="muted">You haven’t made a donation yet.</p>}
      {donations?.length > 0 && (
        <ul className="device-list donation-list">
          {donations.map((d) => (
            <li key={d.id}>
              <span>
                <b>{formatUsd(d.cents)}</b>
                <span className="muted">{formatDonationDate(d.createdAt)}</span>
              </span>
              <span className={d.status === 'succeeded' ? 'donation-status' : 'donation-status failed'}>
                {d.status === 'succeeded' ? 'Paid' : 'Didn’t go through'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {donations?.length === DONATION_HISTORY_LIMIT && <p className="muted">Showing your {DONATION_HISTORY_LIMIT} most recent donations.</p>}
      {donated > 0 && <p className="muted">A new donation can take a few seconds to appear here.</p>}
    </section>
  )
}
