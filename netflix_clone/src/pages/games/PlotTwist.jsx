import { useState } from 'react'
import { useLibrary } from '../../state/libraryContext.js'
import { useT } from '../../state/useT.js'
import { shuffle } from './shuffle.js'

const ROUNDS = 5
const CHOICES = 4

const makeRounds = (titles) => shuffle(titles).slice(0, ROUNDS).map((answer) => ({
  answer,
  options: shuffle([answer, ...shuffle(titles.filter((t) => t.id !== answer.id)).slice(0, CHOICES - 1)]),
}))

export function PlotTwist({ titles }) {
  const t = useT()
  const { bestScores, recordScore } = useLibrary()
  const [rounds, setRounds] = useState(() => makeRounds(titles))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)

  const done = index >= rounds.length
  const round = rounds[index]

  const choose = (title) => {
    if (picked) return
    setPicked(title.id)
    if (title.id === round.answer.id) setScore((s) => s + 1)
  }

  const goToNextRound = () => {
    const last = index + 1 >= rounds.length
    if (last) recordScore('trivia', score, 'high')
    setIndex(index + 1)
    setPicked(null)
  }

  const restart = () => {
    setRounds(makeRounds(titles))
    setIndex(0)
    setPicked(null)
    setScore(0)
  }

  if (done) {
    return (
      <div className="settings">
        <section className="settings-card thanks" role="status">
          <p className="big-check" aria-hidden="true">{score}</p>
          <h2>{t('You scored {score} of {total}', { score, total: rounds.length })}</h2>
          <p className="muted">{t('Best this session: {score}', { score: bestScores.trivia ?? score })}</p>
        </section>
        <button type="button" className="cta" onClick={restart}>{t('Play again')}</button>
      </div>
    )
  }

  const correct = picked === round.answer.id

  return (
    <div className="settings">
      <div className="game-bar">
        <p>{t('Round')} <b>{index + 1}</b> {t('of {total}', { total: rounds.length })}</p>
        <p className="muted">{t('Score: {score}', { score })}</p>
      </div>

      <section className="settings-card" aria-labelledby="plot-q">
        <h2 id="plot-q">{t('Which title is this?')}</h2>
        <blockquote className="plot">“{round.answer.synopsis}”</blockquote>
        <div className="answer-list">
          {round.options.map((option) => {
            const state = !picked ? '' : option.id === round.answer.id ? ' right' : option.id === picked ? ' wrong' : ''
            return (
              <button key={option.id} type="button" className={`answer${state}`} aria-disabled={Boolean(picked)} onClick={() => choose(option)}>
                {option.title}
                {state === ' right' && <span className="sr-only"> {t('— correct answer')}</span>}
                {state === ' wrong' && <span className="sr-only"> {t('— your answer, incorrect')}</span>}
              </button>
            )
          })}
        </div>
        <p className="save-status answer-feedback" role="status">
          {picked && (correct ? t('✓ Correct!') : t('✗ It was {title}.', { title: round.answer.title }))}
        </p>
      </section>

      {picked && <button type="button" className="cta" onClick={goToNextRound} autoFocus>{index + 1 === rounds.length ? t('See score') : t('Next question')}</button>}
    </div>
  )
}
