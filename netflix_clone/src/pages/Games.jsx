import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { MemoryMatch } from './games/MemoryMatch.jsx'
import { PlotTwist } from './games/PlotTwist.jsx'
import { NotFound } from './NotFound.jsx'

const games = {
  memory: { name: 'Poster Match', blurb: 'Flip cards to find matching posters in as few moves as you can.', minTitles: 3, scoreLabel: 'moves', Component: MemoryMatch },
  trivia: { name: 'Plot Twist', blurb: 'Read the synopsis, pick the title. Five rounds.', minTitles: 4, scoreLabel: 'points', Component: PlotTwist },
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
        {titles.length >= game.minTitles
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
            <span className="game-art" aria-hidden="true">{id === 'memory' ? '🃏' : '🎬'}</span>
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
