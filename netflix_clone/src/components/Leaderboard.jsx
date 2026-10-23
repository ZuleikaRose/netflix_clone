import { useEffect, useState } from 'react'
import { fetchLeaderboard, sampleLeaderboard } from '../data/leaderboards.js'
import { getSupabase } from '../lib/supabaseConfig.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useT } from '../state/useT.js'

// A game's top ten, shown under the game, one entry per profile. Members appear only after turning on "Show me on
// leaderboards" (here or in Account), and only by their profile's first name.
export function Leaderboard({ game, better, scoreLabel }) {
  const t = useT()
  const { backend, user, setPreference } = useAuth()
  const { bestScores } = useLibrary()
  const { profile } = useProfile()
  const optedIn = user.preferences.showOnLeaderboards
  const myBest = bestScores[game]
  const [saved, setSaved] = useState({ key: null, rows: null, failed: false })
  const key = `${game}:${profile.id}:${myBest}:${optedIn}`

  // With Supabase, ask again whenever the user's best score or choice changes
  useEffect(() => {
    if (backend !== 'supabase') return undefined
    let ignore = false
    getSupabase()
      .then((supabase) => fetchLeaderboard(supabase, game, profile.id))
      .then((rows) => { if (!ignore) setSaved({ key, rows, failed: false }) })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn('Supabase:', error)
        if (!ignore) setSaved({ key, rows: null, failed: true })
      })
    return () => { ignore = true }
  }, [backend, game, profile.id, key])

  const me = optedIn && myBest !== undefined ? { player: profile.name.trim().split(' ')[0] || t('Member'), score: myBest } : null
  const current = backend === 'supabase' ? (saved.key === key ? saved : null) : { rows: sampleLeaderboard(game, better, me) }

  return (
    <section className="settings-card leaderboard" aria-labelledby="leaderboard-heading">
      <h2 id="leaderboard-heading">{t('Leaderboard')}</h2>
      {!current && <p className="muted" role="status">{t('Loading the leaderboard…')}</p>}
      {current?.failed && <p className="muted" role="status">{t('The leaderboard isn’t available right now. Please try again later.')}</p>}
      {current?.rows && (current.rows.length === 0
        ? <p className="muted">{t('No scores yet. Turn on the switch below and set the first one.')}</p>
        : (
          <ol className="leaderboard-list">
            {current.rows.map((r) => (
              <li key={`${r.place}-${r.player}`} className={r.isMe ? 'me' : undefined}>
                <span className="leaderboard-place" aria-hidden="true">{r.place}</span>
                <span className="leaderboard-player">{r.player}{r.isMe && <span className="muted"> {t('(you)')}</span>}</span>
                <b>{r.score} {t(scoreLabel)}</b>
              </li>
            ))}
          </ol>
        ))}
      <label className="switch-row">
        <span>
          <span className="switch-label">{t('Show me on leaderboards')}</span>
          <span className="muted">{t('Your profiles’ first names and best scores appear here for other members. Off by default.')}</span>
        </span>
        <input type="checkbox" role="switch" checked={optedIn} onChange={(e) => setPreference('showOnLeaderboards', e.target.checked)} />
      </label>
    </section>
  )
}
