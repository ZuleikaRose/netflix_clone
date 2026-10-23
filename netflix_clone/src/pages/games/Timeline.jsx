import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'
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
  const t = useT()
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
    setMoved(t('{title} moved to position {position} of {total}.', { title: card.title, position: to + 1, total: next.length }))
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
          <h2>{t('You put {score} of {total} timelines in order', { score, total: ROUNDS })}</h2>
          <p className="muted">{t('Best: {score}', { score: bestScores.timeline ?? score })}</p>
        </section>
        <button type="button" className="cta" onClick={restart}>{t('Play again')}</button>
      </div>
    )
  }

  const correct = checked && isInOrder(cards)
  const oldestFirst = [...cards].sort((a, b) => a.year - b.year)

  return (
    <div className="settings">
      <div className="game-bar">
        <p>{t('Round')} <b>{round}</b> {t('of {total}', { total: ROUNDS })}</p>
        <p className="muted">{t('Score: {score}', { score })}</p>
      </div>

      <section className="settings-card" aria-labelledby="timeline-q">
        <h2 id="timeline-q">{t('Oldest first: put these in release order')}</h2>
        <ol className="timeline-list">
          {cards.map((card, i) => (
            <li key={card.id} className={`timeline-item${!checked ? '' : oldestFirst[i].id === card.id ? ' right' : ' wrong'}`}>
              <img src={card.image} alt="" style={{ filter: card.tint }} />
              <span className="timeline-copy">
                <b>{card.title}</b>
                <span className="muted">{checked ? t('Released {year}', { year: card.year }) : card.type === 'show' ? t('Series') : t('Film')}</span>
                {checked && <span className="sr-only">{oldestFirst[i].id === card.id ? t(', in the right place') : t(', in the wrong place')}</span>}
              </span>
              {!checked && (
                <span className="timeline-moves">
                  <button type="button" className="icon-button" aria-label={t('Move {title} earlier', { title: card.title })} aria-disabled={i === 0}
                    onClick={() => i > 0 && move(i, i - 1)}>▲</button>
                  <button type="button" className="icon-button" aria-label={t('Move {title} later', { title: card.title })} aria-disabled={i === cards.length - 1}
                    onClick={() => i < cards.length - 1 && move(i, i + 1)}>▼</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">{moved}</p>
        <p className="save-status answer-feedback" role="status">
          {checked && (correct ? t('✓ Perfect order!') : t('✗ Not quite. Oldest first: {titles}.', { titles: oldestFirst.map((title) => `${title.title} (${title.year})`).join(', ') }))}
        </p>
      </section>

      {checked
        ? <button type="button" className="cta" onClick={goToNextRound} autoFocus>{round === ROUNDS ? t('See score') : t('Next round')}</button>
        : <button type="button" className="cta" onClick={check}>{t('Check order')}</button>}
    </div>
  )
}
