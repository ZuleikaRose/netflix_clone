import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { CastCall } from './games/CastCall.jsx'
import { HigherLower } from './games/HigherLower.jsx'
import { MemoryMatch } from './games/MemoryMatch.jsx'
import { PlotTwist } from './games/PlotTwist.jsx'
import { Timeline } from './games/Timeline.jsx'
import { TitleScramble } from './games/TitleScramble.jsx'
import { NotFound } from './NotFound.jsx'

const atLeast = (n) => (titles) => titles.length >= n
// The keys are the routes (/games/:gameId) and the names scores are saved under (game_scores.game)
const games = {
  memory: { name: 'Poster Match', art: '🃏', blurb: 'Flip cards to find matching posters in as few moves as you can.', canPlay: atLeast(3), scoreLabel: 'moves', Component: MemoryMatch },
  trivia: { name: 'Plot Twist', art: '🎬', blurb: 'Read the synopsis, pick the title. Five rounds.', canPlay: atLeast(4), scoreLabel: 'points', Component: PlotTwist },
  timeline: { name: 'Timeline', art: '📅', blurb: 'Put four titles in release order, oldest first. Three rounds.', canPlay: (titles) => new Set(titles.map((t) => t.year)).size >= 4, scoreLabel: 'of 3', Component: Timeline },
  cast: { name: 'Cast Call', art: '🎭', blurb: 'We name an actor, you pick the title they star in. Five rounds.', canPlay: atLeast(4), scoreLabel: 'points', Component: CastCall },
  'higher-lower': { name: 'Higher or Lower', art: '📈', blurb: 'Is the next title more or less popular? Keep your streak going.', canPlay: (titles) => new Set(titles.map((t) => t.popularity)).size >= 2, scoreLabel: 'in a row', Component: HigherLower },
  scramble: { name: 'Title Scramble', art: '🔤', blurb: 'Unscramble the letters to find the title. A hint costs a point.', canPlay: atLeast(1), scoreLabel: 'points', Component: TitleScramble },
}

export function Games() {
  const { gameId } = useParams()
  const { titles } = useCatalog()
  const { bestScores } = useLibrary()

  if (gameId) {
    const game = games[gameId]
    if (!game) return <NotFound />
    return (
      <>
        <PageHeader title={game.name} back />
        {game.canPlay(titles)
          ? <game.Component titles={titles} />
          : (
            <div className="empty">
              <p>Not enough titles for this game with the current maturity setting.</p>
              <Link to="/account" className="play wide">Change in Account</Link>
            </div>
          )}
      </>
    )
  }

  return (
    <>
      <PageHeader title="Games" />
      <div className="settings">
        <p className="auth-copy">Quick games built from the shows and movies you love. Included with your membership.</p>
        {Object.entries(games).map(([id, g]) => (
          <Link key={id} to={`/games/${id}`} className="game-card">
            <span className="game-art" aria-hidden="true">{g.art}</span>
            <span className="game-copy">
              <b>{g.name}</b>
              <span className="muted">{g.blurb}</span>
              {bestScores[id] !== undefined && <span className="game-best">Best: {bestScores[id]} {g.scoreLabel}</span>}
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
