import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { TicketConversation } from '../components/TicketConversation.jsx'
import { ticketStatuses } from '../data/supportApi.js'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useSupportQueue } from '../state/useSupportQueue.js'
import { useReviewReports } from '../state/useReviewReports.js'
import { reasonLabel, reportStatuses } from '../data/reviewReports.js'
import { formatDonationDate, formatUsd } from '../data/donations.js'
import { donationFilters, formatMonth, stripePaymentUrl } from '../data/staffDonations.js'
import { useStaffDonations } from '../state/useStaffDonations.js'
import { NotFound } from './NotFound.jsx'

// One ticket, opened from the queue: details, status and the conversation
function TicketDetail({ ticket, queue }) {
  const { findTitle } = useCatalog()
  const [replies, setReplies] = useState(null)
  const [statusError, setStatusError] = useState(null)

  useEffect(() => {
    let ignore = false
    queue.loadReplies(ticket)
      .then((found) => { if (!ignore) setReplies(found) })
      .catch(() => { if (!ignore) setReplies([]) })
    return () => { ignore = true }
    // Reload when the ticket gets a reply (memory mode keeps replies on the ticket itself)
  }, [ticket.ticketId, ticket.replyCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (body) => {
    const { error, reply } = await queue.reply(ticket, body)
    if (reply) setReplies((all) => [...(all ?? []), reply])
    return error ?? null
  }

  return (
    <div className="ticket-detail">
      <dl className="ticket-facts">
        <dt>Member</dt><dd>{ticket.member} · {ticket.email}</dd>
        <dt>Device</dt><dd>{ticket.device || 'Not given'}</dd>
        {ticket.titleId && <><dt>Title</dt><dd>{findTitle(ticket.titleId)?.title ?? ticket.titleId}</dd></>}
        {ticket.steps && <><dt>Steps</dt><dd>{ticket.steps}</dd></>}
      </dl>
      <label className="select-row">
        <span className="switch-label">Status of {ticket.id}</span>
        <select value={ticket.status} onChange={async (e) => setStatusError(await queue.changeStatus(ticket, e.target.value))}>
          {ticketStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {statusError && <p className="form-alert" role="alert">{statusError}</p>}
      {ticket.type === 'Data removal request' && (
        <p className="muted">Data removal: once the member’s data has been erased, reply to confirm and mark the ticket Resolved.</p>
      )}
      {replies === null
        ? <p className="muted" role="status">Loading the conversation…</p>
        : <TicketConversation ticketNumber={ticket.id} replies={replies} send={send} label={`Reply to ${ticket.member}`} />}
    </div>
  )
}

// /support-dashboard: support staff's ticket queue, reported reviews and donations (everyone else gets the not-found page)
export function SupportDashboard() {
  const { user } = useAuth()
  const [view, setView] = useState('tickets') // 'tickets' | 'reviews' | 'donations'
  if (!user.isStaff) return <NotFound />
  return (
    <>
      <PageHeader title="Support dashboard" back />
      <div className="settings">
        <section className="status-filters" aria-label="Queue">
          {[['tickets', 'Tickets'], ['reviews', 'Reported reviews'], ['donations', 'Donations']].map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'chip active' : 'chip'} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>
          ))}
        </section>
        {view === 'tickets' && <Queue />}
        {view === 'reviews' && <ReviewQueue />}
        {view === 'donations' && <DonationsView />}
      </div>
    </>
  )
}

// Donations: paid and failed totals per month, then the latest donations with a link to each payment in the Stripe
// Dashboard (where refunds are made)
function DonationsView() {
  const [status, setStatus] = useState(null)
  const { months, donations, failed } = useStaffDonations(status)
  const filterLabel = donationFilters.find((f) => f.value === status).label

  return (
    <>
      {failed && <p className="form-alert" role="alert">Donations couldn’t be loaded. Please try again.</p>}
      {!failed && !months && <p className="muted" role="status">Loading donations…</p>}
      {months && (
        <section className="settings-card" aria-labelledby="donation-months-heading">
          <h2 id="donation-months-heading">By month</h2>
          {months.length === 0
            ? <p className="muted">No donations in the last 12 months.</p>
            : (
              <table className="donation-months">
                <thead><tr><th scope="col">Month</th><th scope="col">Paid</th><th scope="col">Donations</th><th scope="col">Didn’t go through</th></tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}><th scope="row">{formatMonth(m.month)}</th><td>{formatUsd(m.paidCents)}</td><td>{m.paidCount}</td><td>{m.failedCount}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      )}
      <section className="status-filters" aria-label="Donation status">
        {donationFilters.map((f) => (
          <button key={f.label} type="button" className={status === f.value ? 'chip active' : 'chip'} aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}>{f.label}</button>
        ))}
      </section>
      {donations?.length === 0 && <p className="muted">No donations to show.</p>}
      {donations?.length > 0 && (
        <ul className="device-list donation-list staff-donations" aria-label={`${filterLabel} donations`}>
          {donations.map((d) => {
            const url = stripePaymentUrl(d.paymentId)
            return (
              <li key={d.id}>
                <span>
                  <b>{formatUsd(d.amount)}</b>
                  <span className="muted">{d.member} · {formatDonationDate(d.at)}{d.monthly && ' · Monthly'}</span>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      Open in Stripe<span className="sr-only"> (new tab): {formatUsd(d.amount)} from {d.member}</span>
                    </a>
                  )}
                </span>
                <span className={d.status === 'succeeded' ? 'donation-status' : 'donation-status failed'}>
                  {d.status === 'succeeded' ? 'Paid' : 'Didn’t go through'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// Reported reviews, grouped by review: keep it, or remove it from the title page
function ReviewQueue() {
  const [status, setStatus] = useState('Open')
  const { reports, failed, resolve } = useReviewReports(status)
  const { findTitle } = useCatalog()
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState('')
  // A removed review's reports have no review id any more: each stands alone
  const groups = Object.values((reports ?? []).reduce((all, r) => {
    const key = r.reviewId ?? r.id
    all[key] = all[key] ? { ...all[key], reports: [...all[key].reports, r] } : { key, first: r, reports: [r] }
    return all
  }, {}))

  const settle = async (group, remove) => {
    const problem = await resolve(group.first.reviewId, remove)
    setErrors((e) => ({ ...e, [group.key]: problem }))
    if (!problem) setDone(`${group.first.author}’s review ${remove ? 'removed' : 'kept'}`)
  }

  return (
    <>
      <section className="status-filters" aria-label="Report status">
        {[...reportStatuses, null].map((s) => (
          <button key={s ?? 'all'} type="button" className={status === s ? 'chip active' : 'chip'} aria-pressed={status === s}
            onClick={() => { setStatus(s); setDone('') }}>{s ?? 'All'}</button>
        ))}
      </section>
      <p className="save-status" role="status">{done && <><span aria-hidden="true">✓</span> {done}</>}</p>
      {failed && <p className="form-alert" role="alert">Reported reviews couldn’t be loaded. Please try again.</p>}
      {!failed && !reports && <p className="muted" role="status">Loading reported reviews…</p>}
      {reports?.length === 0 && <p className="muted">No {status ? status.toLowerCase() : ''} reported reviews.</p>}
      {groups.length > 0 && (
        <ul className="ticket-list staff-queue" aria-label={`${status ?? 'All'} reported reviews`}>
          {groups.map((g) => (
            <li key={g.key} className="settings-card">
              <p><b>{g.first.author}</b> on {findTitle(g.first.titleId)?.title ?? g.first.titleId} <span className="ticket-status">{g.first.status}</span></p>
              <blockquote className="reported-review">{g.first.text}</blockquote>
              <ul className="report-reasons-list">
                {g.reports.map((r) => (
                  <li key={r.id} className="muted">{reasonLabel(r.reason)} · {r.reporter} · {r.at.toLocaleDateString()}{r.details && <> · “{r.details}”</>}</li>
                ))}
              </ul>
              {g.first.status === 'Open' && g.first.reviewId && (
                <div className="report-actions">
                  <button type="button" className="ghost-cta" onClick={() => settle(g, false)}>Keep review</button>
                  <button type="button" className="cta delete-fill" onClick={() => settle(g, true)}>Remove review</button>
                </div>
              )}
              {errors[g.key] && <p className="form-alert" role="alert">{errors[g.key]}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Queue() {
  const [status, setStatus] = useState('Open')
  const [openId, setOpenId] = useState(null)
  const queue = useSupportQueue(status)

  return (
    <>
      <section className="status-filters" aria-label="Ticket status">
        {[...ticketStatuses, null].map((s) => (
          <button key={s ?? 'all'} type="button" className={status === s ? 'chip active' : 'chip'} aria-pressed={status === s}
            onClick={() => { setStatus(s); setOpenId(null) }}>{s ?? 'All'}</button>
        ))}
      </section>
      {queue.failed && <p className="form-alert" role="alert">The ticket queue couldn’t be loaded. Please try again.</p>}
      {!queue.failed && !queue.tickets && <p className="muted" role="status">Loading tickets…</p>}
      {queue.tickets?.length === 0 && <p className="muted">No {status ? status.toLowerCase() : ''} tickets.</p>}
      {queue.tickets?.length > 0 && (
        <ul className="ticket-list staff-queue" aria-label={`${status ?? 'All'} tickets`}>
          {queue.tickets.map((t) => (
            <li key={t.ticketId} className="settings-card">
              <p><b>{t.id}</b> <span className="ticket-status">{t.status}</span>{t.replyCount > 0 && <span className="muted"> · {t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}</span>}</p>
              <p>{t.summary}</p>
              <p className="muted">{t.type} · {t.member} · {t.at.toLocaleDateString()}</p>
              <button type="button" className="ghost-cta" aria-expanded={openId === t.ticketId}
                onClick={() => setOpenId(openId === t.ticketId ? null : t.ticketId)}>
                {openId === t.ticketId ? `Close ${t.id}` : `Open ${t.id}`}
              </button>
              {openId === t.ticketId && <TicketDetail ticket={t} queue={queue} />}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
