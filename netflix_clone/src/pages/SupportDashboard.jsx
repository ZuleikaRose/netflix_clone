import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { TicketConversation } from '../components/TicketConversation.jsx'
import { ticketStatuses } from '../data/supportApi.js'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useSupportQueue } from '../state/useSupportQueue.js'
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

// /support-dashboard: support staff's ticket queue (everyone else gets the not-found page)
export function SupportDashboard() {
  const { user } = useAuth()
  return user.isStaff ? <Queue /> : <NotFound />
}

function Queue() {
  const [status, setStatus] = useState('Open')
  const [openId, setOpenId] = useState(null)
  const queue = useSupportQueue(status)

  return (
    <>
      <PageHeader title="Support dashboard" back />
      <div className="settings">
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
      </div>
    </>
  )
}
