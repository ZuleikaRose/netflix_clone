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
import { useT } from '../state/useT.js'
import { locale } from '../i18n/index.js'
import { NotFound } from './NotFound.jsx'

// List names, empty messages and outcomes per status (null = all), as whole English sentences to translate
const ticketListLabels = { Open: 'Open tickets', 'In progress': 'In progress tickets', Resolved: 'Resolved tickets', null: 'All tickets' }
const noTickets = { Open: 'No open tickets.', 'In progress': 'No in progress tickets.', Resolved: 'No resolved tickets.', null: 'No tickets.' }
const reportListLabels = { Open: 'Open reported reviews', Kept: 'Kept reported reviews', Removed: 'Removed reported reviews', null: 'All reported reviews' }
const noReports = { Open: 'No open reported reviews.', Kept: 'No kept reported reviews.', Removed: 'No removed reported reviews.', null: 'No reported reviews.' }

// One ticket, opened from the queue: details, status and the conversation
function TicketDetail({ ticket, queue }) {
  const t = useT()
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
        <dt>{t('Member')}</dt><dd>{ticket.member} · {ticket.email}</dd>
        <dt>{t('Device')}</dt><dd>{ticket.device || t('Not given')}</dd>
        {ticket.titleId && <><dt>{t('Title')}</dt><dd>{findTitle(ticket.titleId)?.title ?? ticket.titleId}</dd></>}
        {ticket.steps && <><dt>{t('Steps')}</dt><dd>{ticket.steps}</dd></>}
      </dl>
      <label className="select-row">
        <span className="switch-label">{t('Status of {ticket}', { ticket: ticket.id })}</span>
        <select value={ticket.status} onChange={async (e) => setStatusError(await queue.changeStatus(ticket, e.target.value))}>
          {ticketStatuses.map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </select>
      </label>
      {statusError && <p className="form-alert" role="alert">{t(statusError)}</p>}
      {ticket.type === 'Data removal request' && (
        <p className="muted">{t('Data removal: once the member’s data has been erased, reply to confirm and mark the ticket Resolved.')}</p>
      )}
      {replies === null
        ? <p className="muted" role="status">{t('Loading the conversation…')}</p>
        : <TicketConversation ticketNumber={ticket.id} replies={replies} send={send} label={t('Reply to {name}', { name: ticket.member })} />}
    </div>
  )
}

// /support-dashboard: support staff's ticket queue, reported reviews and donations (everyone else gets the not-found page)
export function SupportDashboard() {
  const t = useT()
  const { user } = useAuth()
  const [view, setView] = useState('tickets') // 'tickets' | 'reviews' | 'donations'
  if (!user.isStaff) return <NotFound />
  return (
    <>
      <PageHeader title={t('Support dashboard')} back />
      <div className="settings">
        <section className="status-filters" aria-label={t('Queue')}>
          {[['tickets', 'Tickets'], ['reviews', 'Reported reviews'], ['donations', 'Donations']].map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'chip active' : 'chip'} aria-pressed={view === key} onClick={() => setView(key)}>{t(label)}</button>
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
  const t = useT()
  const [status, setStatus] = useState(null)
  const { months, donations, failed } = useStaffDonations(status)
  const listLabel = status === 'succeeded' ? t('Paid donations') : status === 'failed' ? t('Didn’t go through donations') : t('All donations')

  return (
    <>
      {failed && <p className="form-alert" role="alert">{t('Donations couldn’t be loaded. Please try again.')}</p>}
      {!failed && !months && <p className="muted" role="status">{t('Loading donations…')}</p>}
      {months && (
        <section className="settings-card" aria-labelledby="donation-months-heading">
          <h2 id="donation-months-heading">{t('By month')}</h2>
          {months.length === 0
            ? <p className="muted">{t('No donations in the last 12 months.')}</p>
            : (
              <table className="donation-months">
                <thead><tr><th scope="col">{t('Month')}</th><th scope="col">{t('Paid')}</th><th scope="col">{t('Donations')}</th><th scope="col">{t('Didn’t go through')}</th></tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}><th scope="row">{formatMonth(m.month)}</th><td>{formatUsd(m.paidCents)}</td><td>{m.paidCount}</td><td>{m.failedCount}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      )}
      <section className="status-filters" aria-label={t('Donation status')}>
        {donationFilters.map((f) => (
          <button key={f.label} type="button" className={status === f.value ? 'chip active' : 'chip'} aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}>{t(f.label)}</button>
        ))}
      </section>
      {donations?.length === 0 && <p className="muted">{t('No donations to show.')}</p>}
      {donations?.length > 0 && (
        <ul className="device-list donation-list staff-donations" aria-label={listLabel}>
          {donations.map((d) => {
            const url = stripePaymentUrl(d.paymentId)
            return (
              <li key={d.id}>
                <span>
                  <b>{formatUsd(d.amount)}</b>
                  <span className="muted">{d.member} · {formatDonationDate(d.at)}{d.monthly && ` · ${t('Monthly')}`}</span>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      {t('Open in Stripe')}<span className="sr-only"> {t('(new tab): {amount} from {member}', { amount: formatUsd(d.amount), member: d.member })}</span>
                    </a>
                  )}
                </span>
                <span className={d.status === 'succeeded' ? 'donation-status' : 'donation-status failed'}>
                  {d.status === 'succeeded' ? t('Paid') : t('Didn’t go through')}
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
  const t = useT()
  const [status, setStatus] = useState('Open')
  const { reports, failed, resolve } = useReviewReports(status)
  const { findTitle } = useCatalog()
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(null) // { author, removed } of the last review settled
  // A removed review's reports have no review id any more: each stands alone
  const groups = Object.values((reports ?? []).reduce((all, r) => {
    const key = r.reviewId ?? r.id
    all[key] = all[key] ? { ...all[key], reports: [...all[key].reports, r] } : { key, first: r, reports: [r] }
    return all
  }, {}))

  const settle = async (group, remove) => {
    const problem = await resolve(group.first.reviewId, remove)
    setErrors((e) => ({ ...e, [group.key]: problem }))
    if (!problem) setDone({ author: group.first.author, removed: remove })
  }

  return (
    <>
      <section className="status-filters" aria-label={t('Report status')}>
        {[...reportStatuses, null].map((s) => (
          <button key={s ?? 'all'} type="button" className={status === s ? 'chip active' : 'chip'} aria-pressed={status === s}
            onClick={() => { setStatus(s); setDone(null) }}>{t(s ?? 'All')}</button>
        ))}
      </section>
      <p className="save-status" role="status">{done && <><span aria-hidden="true">✓</span> {done.removed ? t('{author}’s review removed', { author: done.author }) : t('{author}’s review kept', { author: done.author })}</>}</p>
      {failed && <p className="form-alert" role="alert">{t('Reported reviews couldn’t be loaded. Please try again.')}</p>}
      {!failed && !reports && <p className="muted" role="status">{t('Loading reported reviews…')}</p>}
      {reports?.length === 0 && <p className="muted">{t(noReports[status])}</p>}
      {groups.length > 0 && (
        <ul className="ticket-list staff-queue" aria-label={t(reportListLabels[status])}>
          {groups.map((g) => (
            <li key={g.key} className="settings-card">
              <p><b>{g.first.author}</b> {t('on {title}', { title: findTitle(g.first.titleId)?.title ?? g.first.titleId })} <span className="ticket-status">{t(g.first.status)}</span></p>
              <blockquote className="reported-review">{g.first.text}</blockquote>
              <ul className="report-reasons-list">
                {g.reports.map((r) => (
                  <li key={r.id} className="muted">{t(reasonLabel(r.reason))} · {r.reporter} · {r.at.toLocaleDateString(locale())}{r.details && <> · “{r.details}”</>}</li>
                ))}
              </ul>
              {g.first.status === 'Open' && g.first.reviewId && (
                <div className="report-actions">
                  <button type="button" className="ghost-cta" onClick={() => settle(g, false)}>{t('Keep review')}</button>
                  <button type="button" className="cta delete-fill" onClick={() => settle(g, true)}>{t('Remove review')}</button>
                </div>
              )}
              {errors[g.key] && <p className="form-alert" role="alert">{t(errors[g.key])}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Queue() {
  const t = useT()
  const [status, setStatus] = useState('Open')
  const [openId, setOpenId] = useState(null)
  const queue = useSupportQueue(status)

  return (
    <>
      <section className="status-filters" aria-label={t('Ticket status')}>
        {[...ticketStatuses, null].map((s) => (
          <button key={s ?? 'all'} type="button" className={status === s ? 'chip active' : 'chip'} aria-pressed={status === s}
            onClick={() => { setStatus(s); setOpenId(null) }}>{t(s ?? 'All')}</button>
        ))}
      </section>
      {queue.failed && <p className="form-alert" role="alert">{t('The ticket queue couldn’t be loaded. Please try again.')}</p>}
      {!queue.failed && !queue.tickets && <p className="muted" role="status">{t('Loading tickets…')}</p>}
      {queue.tickets?.length === 0 && <p className="muted">{t(noTickets[status])}</p>}
      {queue.tickets?.length > 0 && (
        <ul className="ticket-list staff-queue" aria-label={t(ticketListLabels[status])}>
          {queue.tickets.map((ticket) => (
            <li key={ticket.ticketId} className="settings-card">
              <p>
                <b>{ticket.id}</b> <span className="ticket-status">{t(ticket.status)}</span>
                {ticket.replyCount > 0 && (
                  <span className="muted"> · {ticket.replyCount === 1 ? t('{count} reply', { count: 1 }) : t('{count} replies', { count: ticket.replyCount })}</span>
                )}
              </p>
              <p>{ticket.summary}</p>
              <p className="muted">{t(ticket.type)} · {ticket.member} · {ticket.at.toLocaleDateString(locale())}</p>
              <button type="button" className="ghost-cta" aria-expanded={openId === ticket.ticketId}
                onClick={() => setOpenId(openId === ticket.ticketId ? null : ticket.ticketId)}>
                {openId === ticket.ticketId ? t('Close {ticket}', { ticket: ticket.id }) : t('Open {ticket}', { ticket: ticket.id })}
              </button>
              {openId === ticket.ticketId && <TicketDetail ticket={ticket} queue={queue} />}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
