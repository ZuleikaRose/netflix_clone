import { useState } from 'react'
import { reactionChoices } from '../data/reactions.js'
import { useLibrary } from '../state/libraryContext.js'
import { Icon } from './Icon.jsx'
import { useT } from '../state/useT.js'

// Thumbs ratings for the watching profile: Not for me, I like this, Love this!. Pressing the chosen one again takes
// it back. `beforeSave` (optional) resolves to false when the title can't be stored (a TMDB title must be a `titles`
// row first).
export function TitleReaction({ title, beforeSave }) {
  const t = useT()
  const { reactions, react } = useLibrary()
  const [error, setError] = useState(null)
  const current = reactions[title.id] ?? null

  const choose = async (value) => {
    setError(null)
    const next = current === value ? null : value
    if (next && beforeSave && !(await beforeSave())) return setError(t('Couldn’t save this title. Please try again.'))
    react(title.id, next)
  }

  const chosen = reactionChoices.find((c) => c.value === current)
  return (
    <div className="reaction" role="group" aria-label={t('Rate {title}', { title: title.title })}>
      {reactionChoices.map((c) => (
        <button key={c.value} type="button" className={current === c.value ? 'ghost-action on' : 'ghost-action'} aria-pressed={current === c.value}
          onClick={() => choose(c.value)}>
          <Icon name={c.icon} /><span>{t(c.label)}</span>
        </button>
      ))}
      <p className="sr-only" role="status">{chosen ? t('Rated {choice}', { choice: t(chosen.label) }) : ''}</p>
      {current === 'dislike' && <p className="muted reaction-note">{t('We won’t recommend {title} to this profile.', { title: title.title })}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}
    </div>
  )
}
