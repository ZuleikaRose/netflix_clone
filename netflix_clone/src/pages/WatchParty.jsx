import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { Player } from '../components/Player.jsx'
import { useCopyToClipboard } from '../components/useCopyToClipboard.js'
import { invitePath, joinParty } from '../data/partyApi.js'
import { useProfile } from '../state/profileContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { usePartyChannel } from '../state/usePartyChannel.js'
import { useT } from '../state/useT.js'
import { tr } from '../i18n/index.js'

const MAX_CHAT = 100
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// What a member did, for the activity line ("Sam paused at 1:05")
function describeSync({ by, playing, time, episode }, previousEpisode) {
  if (episode && episode !== previousEpisode) return tr('{name} started episode {episode}', { name: by, episode })
  return playing ? tr('{name} played at {time}', { name: by, time: clock(time) }) : tr('{name} paused at {time}', { name: by, time: clock(time) })
}

function Chat({ messages, onSend }) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }
  return (
    <section className="settings-card" aria-labelledby="party-chat-heading">
      <h2 id="party-chat-heading">{t('Chat')}</h2>
      {messages.length === 0
        ? <p className="muted">{t('Say hi. Messages aren’t saved: they’re gone when the party ends.')}</p>
        : (
          <ol className="party-chat" aria-live="polite" aria-label={t('Party chat')}>
            {messages.map((m) => <li key={m.id}><b>{m.name}</b> {m.text}</li>)}
          </ol>
        )}
      <form className="party-chat-form" onSubmit={submit}>
        <Field label={t('Message')} value={draft} maxLength={300} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
        <button type="submit" className="cta" disabled={!draft.trim()}>{t('Send')}</button>
      </form>
    </section>
  )
}

function Party({ party, title }) {
  const t = useT()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [tabId] = useState(() => crypto.randomUUID())
  const me = useMemo(() => ({ id: tabId, name: profile.name }), [tabId, profile.name])
  const control = useRef(null)
  const synced = useRef(false)
  const episodeNow = useRef(1)
  const [activity, setActivity] = useState('')
  const [messages, setMessages] = useState([])
  const { copied, copy } = useCopyToClipboard()

  const channel = usePartyChannel(party.code, me, (event, payload, reply) => {
    if (event === 'sync') {
      setActivity(describeSync(payload, episodeNow.current))
      episodeNow.current = payload.episode ?? episodeNow.current
      synced.current = true
      control.current?.apply(payload)
    } else if (event === 'hello') {
      const state = control.current?.snapshot()
      if (state) reply('state', state)
    } else if (event === 'state' && !synced.current) {
      synced.current = true
      control.current?.apply(payload)
    } else if (event === 'chat') {
      setMessages((all) => [...all, payload].slice(-MAX_CHAT))
    }
  })

  // Just arrived: ask the others where they are
  const { status, send } = channel
  useEffect(() => {
    if (status === 'live') send('hello', {})
    // Once, when the channel opens
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const shareState = (state) => {
    episodeNow.current = state.episode ?? episodeNow.current
    send('sync', { ...state, by: me.name })
  }
  const sendChat = (text) => {
    const message = { id: crypto.randomUUID(), name: me.name, text }
    setMessages((all) => [...all, message].slice(-MAX_CHAT))
    send('chat', message)
  }
  const link = `${window.location.origin}${invitePath(party)}`

  return (
    <>
      <PageHeader title={t('Watch party')} back />
      <Player title={title} party onUserAction={shareState} controlRef={control} onClose={() => navigate(`/title/${title.id}`)} />
      <div className="settings party">
        <section className="settings-card" aria-labelledby="party-heading">
          <h2 id="party-heading">{title.title}</h2>
          <p className="muted">
            {party.host ? `${t('Hosted by {name}.', { name: party.host })} ` : ''}{t('Play, pause and skip happen for everyone. Starts paused: press play when you’re all here.')}
          </p>
          <p className="party-activity" role="status">{activity}</p>
          {channel.status === 'failed' && <p className="form-alert" role="alert">{t('The party connection was lost. Reload the page to rejoin.')}</p>}
        </section>

        <section className="settings-card" aria-labelledby="party-people-heading">
          <h2 id="party-people-heading">{t('Watching now ({count})', { count: channel.people.length })}</h2>
          <ul className="party-people">
            {channel.people.map((p) => <li key={p.id}>{p.name}{p.id === me.id && <span className="muted"> ({t('you')})</span>}</li>)}
          </ul>
          <Field label={t('Invite link')} value={link} readOnly onFocus={(e) => e.target.select()} />
          <button type="button" className="ghost-cta" onClick={() => copy('invite', link)}>{t('Copy invite link')}</button>
          <p className="save-status" role="status">
            {copied?.ok && <><span aria-hidden="true">✓</span> {t('Link copied')}</>}
            {copied && !copied.ok && t('Couldn’t copy: select the link above and copy it yourself.')}
          </p>
        </section>

        <Chat messages={messages} onSend={sendChat} />
        <Link to={`/title/${title.id}`} className="ghost-cta">{t('Leave the party')}</Link>
      </div>
    </>
  )
}

// /party/:code: a watch party. Joins it (adding this member with Supabase), then shows the shared player.
export function WatchParty() {
  const t = useT()
  const { code } = useParams()
  const [params] = useSearchParams()
  const titleFromLink = params.get('t')
  const { findTitle, isAllowed } = useCatalog()
  const [joined, setJoined] = useState({ code: null })

  useEffect(() => {
    let ignore = false
    joinParty(code, titleFromLink)
      .then((party) => { if (!ignore) setJoined({ code, party }) })
      .catch((error) => { if (!ignore) setJoined({ code, error: error.message }) })
    return () => { ignore = true }
  }, [code, titleFromLink])

  const ready = joined.code === code
  const title = joined.party ? findTitle(joined.party.titleId) : null
  if (!ready || joined.error || !title || !isAllowed(title)) {
    const message = !ready ? t('Joining the watch party…')
      : joined.error != null ? t(joined.error)
        : !title ? t('This watch party’s title isn’t available.') : t('{title} is above this profile’s maturity setting.', { title: title.title })
    return (
      <>
        <PageHeader title={t('Watch party')} back />
        <div className="empty" role={ready ? 'alert' : 'status'}>
          <p>{message}</p>
          {ready && <Link to="/" className="play wide">{t('Go Home')}</Link>}
        </div>
      </>
    )
  }
  return <Party key={code} party={joined.party} title={title} />
}
