import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { faqs } from '../../data/faqs.js'
import { serviceStatus } from '../../data/serviceStatus.js'
import { tr } from '../../i18n/index.js'
import { useAuth } from '../../state/authContext.js'
import { useT } from '../../state/useT.js'

const topics = [
  { to: '/info/faqs', title: 'FAQs', body: 'Answers about your account, billing and watching.' },
  { to: '/info/report-issue', title: 'Report an issue', body: 'Playback trouble, bugs or something not working.' },
  { to: '/info/feedback', title: 'Give feedback', body: 'Tell us what you love or what to improve.' },
  { to: '/info/tech-requirements', title: 'Technical requirements', body: 'Supported devices and recommended speeds.' },
]

// Canned replies: there's no live agent, so the "agent" answers from the FAQ list, in the interface language (a
// question matches in English or in that language)
function replyTo(text) {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 3)
  const match = faqs.find((f) => words.some((w) => `${f.q} ${tr(f.q)}`.toLowerCase().includes(w)))
  return match
    ? tr('{answer} (From FAQ: “{question}”)', { answer: tr(match.a), question: tr(match.q) })
    : tr('Thanks! I couldn’t find an exact answer. You can report an issue and our team will follow up.')
}

function LiveChat({ name }) {
  const t = useT()
  const [messages, setMessages] = useState(() => [{ from: 'agent', text: t('Hi {name}! How can we help today?', { name }) }])
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
      <h2 id="chat-heading">{t('Live chat')}</h2>
      <ol className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`bubble ${m.from}`}><span className="sr-only">{m.from === 'you' ? t('You') : t('Support')}: </span>{m.text}</li>
        ))}
        {typing && <li className="bubble agent typing">{t('Support is typing…')}</li>}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <label htmlFor="chat-input" className="sr-only">{t('Message')}</label>
        <input id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('Type a question')} autoComplete="off" />
        <button type="submit" className="cta" disabled={!draft.trim()}>{t('Send')}</button>
      </form>
    </section>
  )
}

export function Support() {
  const t = useT()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [query, setQuery] = useState('')

  return (
    <div className="settings">
      <p className="status-banner" role="status"><span className="dot" aria-hidden="true" /> {serviceStatus.operational ? t('All systems operational') : t('Service disruption')}</p>
      {serviceStatus.notice && <p className="service-banner inline"><b>{t(serviceStatus.notice.title)}:</b> {t(serviceStatus.notice.message)}</p>}

      <form className="help-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/info/faqs?q=${encodeURIComponent(query.trim())}`) }}>
        <label htmlFor="help-q" className="sr-only">{t('Search help articles')}</label>
        <input id="help-q" type="search" className="search-input" placeholder={t('Search help articles')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>

      <ul className="topic-grid">
        {topics.map((topic) => (
          <li key={topic.to}><Link to={topic.to} className="topic-card"><b>{t(topic.title)}</b><span className="muted">{t(topic.body)}</span></Link></li>
        ))}
      </ul>

      <section className="settings-card" aria-labelledby="contact-heading">
        <h2 id="contact-heading">{t('Contact us')}</h2>
        <p className="muted">{t('Live chat is available 24/7. Average reply time: under a minute.')}</p>
        <button type="button" className="cta" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? t('Close chat') : t('Start live chat')}</button>
        <a className="ghost-cta" href="tel:+18005550199">{t('Call {phone}', { phone: '1-800-555-0199' })}</a>
      </section>

      {chatOpen && <LiveChat name={user.name} />}
    </div>
  )
}
