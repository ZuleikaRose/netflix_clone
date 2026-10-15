import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { faqs } from '../../data/faqs.js'
import { useAuth } from '../../state/authContext.js'

const topics = [
  { to: '/info/faqs', title: 'FAQs', body: 'Answers about your account, billing and watching.' },
  { to: '/info/report-issue', title: 'Report an issue', body: 'Playback trouble, bugs or something not working.' },
  { to: '/info/feedback', title: 'Give feedback', body: 'Tell us what you love or what to improve.' },
  { to: '/info/tech-requirements', title: 'Technical requirements', body: 'Supported devices and recommended speeds.' },
]

// Canned replies: the demo has no backend, so the "agent" answers from the FAQ list
function replyTo(text) {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  const match = faqs.find((f) => words.some((w) => f.q.toLowerCase().includes(w)))
  return match
    ? `${match.a} (From FAQ: “${match.q}”)`
    : 'Thanks! I couldn’t find an exact answer. You can report an issue and our team will follow up.'
}

function LiveChat({ name }) {
  const [messages, setMessages] = useState([{ from: 'agent', text: `Hi ${name}! How can we help today?` }])
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const logRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [messages, typing])

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { from: 'you', text }])
    setDraft('')
    setTyping(true)
    timer.current = setTimeout(() => {
      setMessages((m) => [...m, { from: 'agent', text: replyTo(text) }])
      setTyping(false)
    }, 700)
  }

  return (
    <section className="settings-card chat" aria-labelledby="chat-heading">
      <h2 id="chat-heading">Live chat</h2>
      <ol className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`bubble ${m.from}`}><span className="sr-only">{m.from === 'you' ? 'You' : 'Support'}: </span>{m.text}</li>
        ))}
        {typing && <li className="bubble agent typing">Support is typing…</li>}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a question" autoComplete="off" />
        <button type="submit" className="cta" disabled={!draft.trim()}>Send</button>
      </form>
    </section>
  )
}

export function Support() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [query, setQuery] = useState('')

  return (
    <div className="settings">
      <p className="status-banner" role="status"><span className="dot" aria-hidden="true" /> All systems operational</p>

      <form className="help-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/info/faqs?q=${encodeURIComponent(query.trim())}`) }}>
        <label htmlFor="help-q" className="sr-only">Search help articles</label>
        <input id="help-q" type="search" className="search-input" placeholder="Search help articles" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>

      <ul className="topic-grid">
        {topics.map((t) => (
          <li key={t.to}><Link to={t.to} className="topic-card"><b>{t.title}</b><span className="muted">{t.body}</span></Link></li>
        ))}
      </ul>

      <section className="settings-card" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact us</h2>
        <p className="muted">Live chat is available 24/7. Average reply time: under a minute.</p>
        <button type="button" className="cta" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? 'Close chat' : 'Start live chat'}</button>
        <a className="ghost-cta" href="tel:+18005550199">Call 1-800-555-0199</a>
      </section>

      {chatOpen && <LiveChat name={user.name} />}
    </div>
  )
}
