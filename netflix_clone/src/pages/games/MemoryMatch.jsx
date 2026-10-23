import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'
import { shuffle } from './shuffle.js'

const PAIRS = 6

const makeDeck = (titles) => shuffle(shuffle(titles).slice(0, PAIRS).flatMap((t) => [{ key: `${t.id}-a`, title: t }, { key: `${t.id}-b`, title: t }]))

export function MemoryMatch({ titles }) {
  const t = useT()
  const { bestScores, recordScore } = useLibrary()
  const [deck, setDeck] = useState(() => makeDeck(titles))
  const [open, setOpen] = useState([])
  const [matched, setMatched] = useState([])
  const [moves, setMoves] = useState(0)
  const timer = useRef(null)
  const boardTop = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const pairs = deck.length / 2
  const won = matched.length === pairs

  const flip = (index) => {
    if (open.length === 2 || open.includes(index) || matched.includes(deck[index].title.id)) return
    const next = [...open, index]
    setOpen(next)
    if (next.length < 2) return

    const moveCount = moves + 1
    setMoves(moveCount)
    const [a, b] = next.map((i) => deck[i].title.id)
    if (a === b) {
      const nowMatched = [...matched, a]
      setMatched(nowMatched)
      setOpen([])
      if (nowMatched.length === pairs) recordScore('memory', moveCount, 'low')
    } else {
      // Leave the mismatch visible briefly so the player can memorize it
      timer.current = setTimeout(() => setOpen([]), 800)
    }
  }

  const restart = () => {
    clearTimeout(timer.current)
    setDeck(makeDeck(titles))
    setOpen([])
    setMatched([])
    setMoves(0)
    // The restart button sits below the board — bring the fresh board back into view
    boardTop.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="settings">
      <div className="game-bar" ref={boardTop}>
        <p role="status"><b>{moves}</b> {t('moves · {matched}/{pairs} pairs', { matched: matched.length, pairs })}</p>
        <p className="muted">{t('Best: {score}', { score: bestScores.memory ?? '—' })}</p>
      </div>

      <div className="memory-grid">
        {deck.map((card, i) => {
          const isMatched = matched.includes(card.title.id)
          const faceUp = isMatched || open.includes(i)
          return (
            <button
              key={card.key}
              type="button"
              className={`memory-card${faceUp ? ' up' : ''}${isMatched ? ' matched' : ''}`}
              aria-label={faceUp ? (isMatched ? t('{title}, matched', { title: card.title.title }) : card.title.title) : t('Card {number}, face down', { number: i + 1 })}
              aria-disabled={isMatched}
              onClick={() => flip(i)}
            >
              <span className="memory-inner" aria-hidden="true">
                <span className="memory-back">N</span>
                <span className="memory-front">
                  <img src={card.title.image} alt="" style={{ filter: card.title.tint }} />
                  <span>{card.title.title}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {won && (
        <section className="settings-card thanks" role="status">
          <p className="big-check" aria-hidden="true">✓</p>
          <h2>{t('All pairs found in {moves} moves!', { moves })}</h2>
          {bestScores.memory === moves && <p className="muted">{t('That’s your best this session.')}</p>}
        </section>
      )}
      <button type="button" className={won ? 'cta' : 'ghost-cta'} onClick={restart}>{won ? t('Play again') : t('Restart')}</button>
    </div>
  )
}
