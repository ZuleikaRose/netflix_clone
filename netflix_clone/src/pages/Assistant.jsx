import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { describeLength } from '../data/catalog.js'
import { MAX_REQUEST_LENGTH, askAssistant, exampleRequests } from '../data/assistant.js'
import { notDisliked, reactedWith } from '../data/reactions.js'
import { authBackend } from '../lib/supabaseConfig.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { focusFirstError } from './formUtils.js'
import { useT } from '../state/useT.js'

// /what-to-watch: ask in plain words, get up to five titles with a reason each (data/assistant.js)
export function Assistant() {
  const t = useT()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { favorites, reactions } = useLibrary()
  const { titles, findTitle, isAllowed } = useCatalog()
  const [request, setRequest] = useState('')
  const [error, setError] = useState(null)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState(null) // { request, picks, note, by, unavailable? }

  const ask = async (text, form) => {
    const trimmed = text.trim()
    const problem = trimmed.length < 3 ? t('Tell us a little about what you feel like watching.')
      : trimmed.length > MAX_REQUEST_LENGTH ? t('Please keep it under {max} characters.', { max: MAX_REQUEST_LENGTH }) : null
    setError(problem)
    if (problem) return form && focusFirstError(form)
    setAsking(true)
    // Taste only with personalized recommendations on (Account → Privacy)
    const liked = user.preferences.personalized ? [...reactedWith(reactions, 'love', 'like'), ...[...favorites].reverse()] : []
    const found = await askAssistant(trimmed, { profileId: profile.id, liked: [...new Set(liked)], titles: titles.filter(notDisliked(reactions)) })
    setAsking(false)
    setAnswer({ request: trimmed, ...found })
  }
  const submit = (e) => {
    e.preventDefault()
    ask(request, e.currentTarget)
  }
  const tryExample = (text) => {
    setRequest(text)
    ask(text)
  }

  // Titles the answer names that this profile can open (the function already keeps to the profile's rating)
  const picks = (answer?.picks ?? []).map((p) => ({ ...p, title: findTitle(p.id) })).filter((p) => p.title && isAllowed(p.title))

  return (
    <>
      <PageHeader title={t('What should I watch?')} back />
      <div className="settings assistant">
        <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="assistant-heading" aria-busy={asking}>
          <h2 id="assistant-heading">{t('Tell us what you’re in the mood for')}</h2>
          <div className={error ? 'field has-error' : 'field'}>
            <label htmlFor="assistant-request">{t('Your request')}</label>
            <textarea id="assistant-request" rows="3" maxLength={MAX_REQUEST_LENGTH} value={request} aria-invalid={Boolean(error)}
              aria-describedby={error ? 'assistant-error' : 'assistant-hint'} placeholder={t('Something tense under two hours')}
              onChange={(e) => setRequest(e.target.value)} />
            {error
              ? <p id="assistant-error" className="field-error"><span aria-hidden="true">⚠</span> {error}</p>
              : <p id="assistant-hint" className="field-hint">{t('A mood, a genre, who you’re watching with, how long you have…')}</p>}
          </div>
          <button type="submit" className="cta" disabled={asking}>{asking ? t('Thinking…') : t('Suggest titles')}</button>
          <div className="assistant-examples" role="group" aria-label={t('Example requests')}>
            {exampleRequests.map((text) => <button key={text} type="button" className="chip" onClick={() => tryExample(t(text))} disabled={asking}>{t(text)}</button>)}
          </div>
        </form>

        <section className="settings-card" aria-labelledby="assistant-results-heading" aria-live="polite">
          <h2 id="assistant-results-heading">{answer ? t('For “{request}”', { request: answer.request }) : t('Suggestions')}</h2>
          {!answer && !asking && <p className="muted">{t('Ask above and we’ll suggest up to five titles for {name}.', { name: profile.name })}</p>}
          {asking && <p className="muted" role="status">{t('Finding something for you…')}</p>}
          {answer && !asking && (
            <>
              {answer.unavailable && <p className="muted">{t(answer.unavailable)} {t('These picks match your words instead.')}</p>}
              {picks.length > 0 && (
                <ol className="assistant-picks">
                  {picks.map(({ id, reason, title }) => (
                    <li key={id}>
                      <img src={title.image} alt="" style={{ filter: title.source === 'tmdb' ? 'none' : `brightness(.8) ${title.tint}` }} />
                      <span>
                        <Link to={title.path ?? `/title/${title.id}`} className="history-title">{title.title}</Link>
                        <span className="muted">{[title.year, title.maturity, describeLength(title)].filter(Boolean).join(' · ')}</span>
                        <span>{reason}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="muted">{answer.note}</p>
              <p className="assistant-by">{answer.by === 'ai' ? t('Suggested by AI (Claude, from Anthropic).') : t('Suggested by matching words, not AI.')}</p>
            </>
          )}
        </section>

        <p className="muted assistant-privacy">
          {authBackend === 'supabase'
            ? <>{user.preferences.personalized
              ? t('Your request and the names of titles this profile loved or liked go to Anthropic’s AI service to choose from our catalog. Your name and email never do.')
              : t('Your request go to Anthropic’s AI service to choose from our catalog. Your name and email never do.')} </>
            : <>{t('Without the AI service, suggestions come from matching your words to our catalog.')} </>}
          <Link to="/info/ai" className="inline-link">{t('How we use AI')}</Link>
        </p>
      </div>
    </>
  )
}
