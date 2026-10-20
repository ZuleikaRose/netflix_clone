import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { shuffle } from './shuffle.js'

const ROUNDS = 3
const TIMELINE_CARDS = 4 // Games.jsx only offers the game when the catalog has this many release years

// One title per release year, so every round has exactly one right order
const makeRound = (titles) => {
  const byYear = new Map(shuffle(titles).map((t) => [t.year, t]))
  return shuffle([...byYear.values()].slice(0, TIMELINE_CARDS))
}
const isInOrder = (cards) => cards.every((t, i) => i === 0 || cards[i - 1].year < t.year)

export function Timeline({ titles }) {
  const { bestScores, recordScore } = useLibrary()
  const [round, setRound] = useState(1)
  const [cards, setCards] = useState(() => makeRound(titles))
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [moved, setMoved] = useState('')
  const [done, setDone] = useState(false)

  const move = (from, to) => {
    const next = [...cards]
    const [card] = next.splice(from, 1)
    next.splice(to, 0, card)
    setCards(next)
    setMoved(`${card.title} moved to position ${to + 1} of ${next.length}.`)
  }

  const check = () => {
    setChecked(true)
    if (isInOrder(cards)) setScore((s) => s + 1)
  }

  const goToNextRound = () => {
    if (round === ROUNDS) {
      recordScore('timeline', score, 'high')
      setDone(true)
      return
    }
    setRound(round + 1)
    setCards(makeRound(titles))
    setChecked(false)
    setMoved('')
  }

  const restart = () => {
    setRound(1)
    setCards(makeRound(titles))
    setChecked(false)
    setScore(0)
    setMoved('')
    setDone(false)
  }

  if (done) {
    return (
      <div className="settings">
        <section className="settings-card thanks" role="status">
          <p className="big-check" aria-hidden="true">{score}</p>
          <h2>You put {score} of {ROUNDS} timelines in order</h2>
          <p className="muted">Best: {bestScores.timeline ?? score}</p>
        </section>
        <button type="button" className="cta" onClick={restart}>Play again</button>
      </div>
    )
  }

  const correct = checked && isInOrder(cards)
  const oldestFirst = [...cards].sort((a, b) => a.year - b.year)

  return (
    <div className="settings">
      <div className="game-bar">
        <p>Round <b>{round}</b> of {ROUNDS}</p>
        <p className="muted">Score: {score}</p>
      </div>

      <section className="settings-card" aria-labelledby="timeline-q">
        <h2 id="timeline-q">Oldest first: put these in release order</h2>
        <ol className="timeline-list">
          {cards.map((t, i) => (
            <li key={t.id} className={`timeline-item${!checked ? '' : oldestFirst[i].id === t.id ? ' right' : ' wrong'}`}>
              <img src={t.image} alt="" style={{ filter: t.tint }} />
              <span className="timeline-copy">
                <b>{t.title}</b>
                <span className="muted">{checked ? `Released ${t.year}` : t.type === 'show' ? 'Series' : 'Film'}</span>
                {checked && <span className="sr-only">{oldestFirst[i].id === t.id ? ', in the right place' : ', in the wrong place'}</span>}
              </span>
              {!checked && (
                <span className="timeline-moves">
                  <button type="button" className="icon-button" aria-label={`Move ${t.title} earlier`} aria-disabled={i === 0}
                    onClick={() => i > 0 && move(i, i - 1)}>▲</button>
                  <button type="button" className="icon-button" aria-label={`Move ${t.title} later`} aria-disabled={i === cards.length - 1}
                    onClick={() => i < cards.length - 1 && move(i, i + 1)}>▼</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">{moved}</p>
        <p className="save-status answer-feedback" role="status">
          {checked && (correct ? '✓ Perfect order!' : `✗ Not quite. Oldest first: ${oldestFirst.map((t) => `${t.title} (${t.year})`).join(', ')}.`)}
        </p>
      </section>

      {checked
        ? <button type="button" className="cta" onClick={goToNextRound} autoFocus>{round === ROUNDS ? 'See score' : 'Next round'}</button>
        : <button type="button" className="cta" onClick={check}>Check order</button>}
    </div>
  )
}
