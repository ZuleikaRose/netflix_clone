import { useState } from 'react'
import { reactionChoices } from '../data/reactions.js'
import { useLibrary } from '../state/libraryContext.js'
import { Icon } from './Icon.jsx'

// Thumbs ratings for the watching profile: Not for me, I like this, Love this!. Pressing the chosen one again takes
// it back. `beforeSave` (optional) resolves to false when the title can't be stored (a TMDB title must be a `titles`
// row first).
export function TitleReaction({ title, beforeSave }) {
  const { reactions, react } = useLibrary()
  const [error, setError] = useState(null)
  const current = reactions[title.id] ?? null

  const choose = async (value) => {
    setError(null)
    const next = current === value ? null : value
    if (next && beforeSave && !(await beforeSave())) return setError('Couldn’t save this title. Please try again.')
    react(title.id, next)
  }

  const chosen = reactionChoices.find((c) => c.value === current)
  return (
    <div className="reaction" role="group" aria-label={`Rate ${title.title}`}>
      {reactionChoices.map((c) => (
        <button key={c.value} type="button" className={current === c.value ? 'ghost-action on' : 'ghost-action'} aria-pressed={current === c.value}
          onClick={() => choose(c.value)}>
          <Icon name={c.icon} /><span>{c.label}</span>
        </button>
      ))}
      <p className="sr-only" role="status">{chosen ? `Rated ${chosen.label}` : ''}</p>
      {current === 'dislike' && <p className="muted reaction-note">We won’t recommend {title.title} to this profile.</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}
    </div>
  )
}
