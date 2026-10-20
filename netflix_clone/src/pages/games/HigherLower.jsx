import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { shuffle } from './shuffle.js'

// A title to compare with `current`: never the same one, never an equal score (that guess would have no answer)
const pickNext = (titles, current) => shuffle(titles.filter((t) => t.id !== current.id && t.popularity !== current.popularity))[0]

const firstPair = (titles) => {
  const current = shuffle(titles)[0]
  return { current, next: pickNext(titles, current) }
}

function Poster({ title, score }) {
  return (
    <figure className="hl-card">
      <img src={title.image} alt="" style={{ filter: title.tint }} />
      <figcaption>
        <b>{title.title}</b>
        <span className="muted">{title.year} · {title.type === 'show' ? 'Series' : 'Film'}</span>
        <span className="hl-score">{score ?? '?'}</span>
      </figcaption>
    </figure>
  )
}

export function HigherLower({ titles }) {
  const { bestScores, recordScore } = useLibrary()
  const [pair, setPair] = useState(() => firstPair(titles))
  const [streak, setStreak] = useState(0)
  const [result, setResult] = useState(null) // null while guessing, then 'right' | 'wrong'

  const guess = (higher) => {
    if (result) return
    const right = (pair.next.popularity > pair.current.popularity) === higher
    setResult(right ? 'right' : 'wrong')
    if (right) setStreak((s) => s + 1)
    else recordScore('higher-lower', streak, 'high')
  }

  const goOn = () => {
    const current = pair.next
    setPair({ current, next: pickNext(titles, current) })
    setResult(null)
  }

  const restart = () => {
    setPair(firstPair(titles))
    setStreak(0)
    setResult(null)
  }

  const { current, next } = pair
  const isHigher = next.popularity > current.popularity

  return (
    <div className="settings">
      <div className="game-bar">
        <p>Streak: <b>{streak}</b></p>
        <p className="muted">Best: {bestScores['higher-lower'] ?? '—'}</p>
      </div>

      <section className="settings-card" aria-labelledby="hl-q">
        <h2 id="hl-q">Is {next.title} more or less popular than {current.title}?</h2>
        <div className="hl-pair">
          <Poster title={current} score={current.popularity} />
          <span className="hl-vs" aria-hidden="true">vs</span>
          <Poster title={next} score={result ? next.popularity : null} />
        </div>
        <p className="muted hl-note">Popularity scores run from 0 to 100.</p>
        {!result && (
          <div className="hl-actions">
            <button type="button" className="ghost-cta" onClick={() => guess(true)}>▲ Higher</button>
            <button type="button" className="ghost-cta" onClick={() => guess(false)}>▼ Lower</button>
          </div>
        )}
        <p className="save-status answer-feedback" role="status">
          {result && `${result === 'right' ? '✓ Right!' : '✗ Wrong.'} ${next.title} scores ${next.popularity}, ${isHigher ? 'higher' : 'lower'} than ${current.popularity}.`}
        </p>
      </section>

      {result === 'right' && <button type="button" className="cta" onClick={goOn} autoFocus>Next title</button>}
      {result === 'wrong' && (
        <section className="settings-card thanks" role="status">
          <h2>Your streak: {streak}</h2>
          <button type="button" className="cta" onClick={restart} autoFocus>Play again</button>
        </section>
      )}
    </div>
  )
}
