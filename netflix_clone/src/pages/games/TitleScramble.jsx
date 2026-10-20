import { useRef, useState } from 'react'
import { Field } from '../../components/Field.jsx'
import { useLibrary } from '../../state/libraryContext.js'
import { shuffle } from './shuffle.js'

const ROUNDS = 5
const GUESSES = 3
const POINTS = { clean: 2, hinted: 1 }

const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

// Each word's letters shuffled, reshuffled until at least one word looks different
function scramble(title) {
  const words = title.toUpperCase().split(' ')
  for (let tries = 0; tries < 10; tries++) {
    const mixed = words.map((w) => shuffle([...w]).join(''))
    if (mixed.join(' ') !== words.join(' ')) return mixed.join(' ')
  }
  return words.map((w) => [...w].reverse().join('')).join(' ')
}

const makeRounds = (titles) => shuffle(titles).slice(0, ROUNDS).map((answer) => ({ answer, letters: scramble(answer.title) }))

export function TitleScramble({ titles }) {
  const { bestScores, recordScore } = useLibrary()
  const [rounds, setRounds] = useState(() => makeRounds(titles))
  const [index, setIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [error, setError] = useState(null)
  const [guessesLeft, setGuessesLeft] = useState(GUESSES)
  const [hinted, setHinted] = useState(false)
  const [outcome, setOutcome] = useState(null) // null while playing, then 'solved' | 'missed'
  const [score, setScore] = useState(0)
  const form = useRef(null)

  const done = index >= rounds.length
  const round = rounds[index]

  const submit = (e) => {
    e.preventDefault()
    if (outcome) return
    if (!guess.trim()) {
      setError('Type the title you think it is.')
      form.current.querySelector('input').focus()
      return
    }
    if (normalize(guess) === normalize(round.answer.title)) {
      setError(null)
      setOutcome('solved')
      setScore((s) => s + (hinted ? POINTS.hinted : POINTS.clean))
      return
    }
    const left = guessesLeft - 1
    setGuessesLeft(left)
    if (left === 0) {
      setError(null)
      setOutcome('missed')
    } else {
      setError(`Not quite. ${left} ${left === 1 ? 'guess' : 'guesses'} left.`)
      form.current.querySelector('input').focus()
    }
  }

  const goToNextRound = () => {
    if (index + 1 >= rounds.length) recordScore('scramble', score, 'high')
    setIndex(index + 1)
    setGuess('')
    setError(null)
    setGuessesLeft(GUESSES)
    setHinted(false)
    setOutcome(null)
  }

  const restart = () => {
    setRounds(makeRounds(titles))
    setIndex(0)
    setGuess('')
    setError(null)
    setGuessesLeft(GUESSES)
    setHinted(false)
    setOutcome(null)
    setScore(0)
  }

  const maxScore = rounds.length * POINTS.clean

  if (done) {
    return (
      <div className="settings">
        <section className="settings-card thanks" role="status">
          <p className="big-check" aria-hidden="true">{score}</p>
          <h2>You scored {score} of {maxScore}</h2>
          <p className="muted">Best: {bestScores.scramble ?? score}</p>
        </section>
        <button type="button" className="cta" onClick={restart}>Play again</button>
      </div>
    )
  }

  return (
    <div className="settings">
      <div className="game-bar">
        <p>Round <b>{index + 1}</b> of {rounds.length}</p>
        <p className="muted">Score: {score}</p>
      </div>

      <section className="settings-card" aria-labelledby="scramble-q">
        <h2 id="scramble-q">Unscramble the title</h2>
        <p className="scramble-letters" aria-hidden="true">{round.letters}</p>
        <p className="sr-only">Scrambled letters: {round.letters.split(' ').map((w) => w.split('').join(' ')).join(', then ')}</p>
        <p className="muted">2 points, or 1 with a hint. {GUESSES} guesses per title.</p>

        {hinted && (
          <p className="scramble-hint">
            <span className="sr-only">Hint: </span>
            {round.answer.type === 'show' ? 'A series' : 'A film'} from {round.answer.year} · {round.answer.genres.join(', ')}
          </p>
        )}

        {!outcome && (
          <form ref={form} className="scramble-form" onSubmit={submit} noValidate>
            <Field label="Your answer" value={guess} error={error} autoComplete="off" onChange={(e) => setGuess(e.target.value)} />
            <div className="hl-actions">
              <button type="submit" className="cta">Guess</button>
              {!hinted && <button type="button" className="ghost-cta" onClick={() => setHinted(true)}>Show a hint</button>}
            </div>
          </form>
        )}
        <p className="save-status answer-feedback" role="status">
          {outcome === 'solved' && `✓ ${round.answer.title}! +${hinted ? POINTS.hinted : POINTS.clean}`}
          {outcome === 'missed' && `✗ Out of guesses. It was ${round.answer.title}.`}
        </p>
      </section>

      {outcome && <button type="button" className="cta" onClick={goToNextRound} autoFocus>{index + 1 === rounds.length ? 'See score' : 'Next title'}</button>}
    </div>
  )
}
