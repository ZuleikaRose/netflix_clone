import { useState } from 'react'
import { locale } from '../i18n/index.js'
import { useT } from '../state/useT.js'

const when = (date) => date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })

// A ticket's replies, oldest first, and a form to add one. `send(body)` resolves to an error message (English, shown
// in the interface language) or null. `label` comes translated.
export function TicketConversation({ ticketNumber, replies, send, label }) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const id = `reply-${ticketNumber}`

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    const problem = await send(draft.trim())
    setBusy(false)
    setError(problem)
    if (!problem) setDraft('')
  }

  return (
    <div className="ticket-conversation">
      {replies.length > 0 && (
        <ol className="reply-list" aria-label={t('Replies on {ticket}', { ticket: ticketNumber })}>
          {replies.map((r) => (
            <li key={r.id} className={r.fromStaff ? 'staff' : undefined}>
              <p><b>{r.author}</b> <span className="muted">{when(r.at)}</span></p>
              <p>{r.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="reply-form" onSubmit={submit}>
        <label htmlFor={id}>{label ?? t('Reply')}</label>
        <textarea id={id} rows="2" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="cta" disabled={busy || !draft.trim()}>{t('Send reply')}</button>
        {error && <p className="form-alert" role="alert">{t(error)}</p>}
      </form>
    </div>
  )
}
