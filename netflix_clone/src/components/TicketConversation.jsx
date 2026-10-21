import { useState } from 'react'

const when = (date) => date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

// A ticket's replies, oldest first, and a form to add one. `send(body)` resolves to an error message or null.
export function TicketConversation({ ticketNumber, replies, send, label = 'Reply' }) {
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
        <ol className="reply-list" aria-label={`Replies on ${ticketNumber}`}>
          {replies.map((r) => (
            <li key={r.id} className={r.fromStaff ? 'staff' : undefined}>
              <p><b>{r.author}</b> <span className="muted">{when(r.at)}</span></p>
              <p>{r.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="reply-form" onSubmit={submit}>
        <label htmlFor={id}>{label}</label>
        <textarea id={id} rows="2" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="cta" disabled={busy || !draft.trim()}>Send reply</button>
        {error && <p className="form-alert" role="alert">{error}</p>}
      </form>
    </div>
  )
}
