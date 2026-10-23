import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickSurprise } from '../data/surprise.js'
import { listedTitles } from '../data/tmdbApi.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { useTmdbLists } from '../state/useTmdb.js'
import { useT } from '../state/useT.js'

// The last pick, so pressing again (or coming back) shows something else
let previous = null

// Opens a random title the watching profile can watch (data/surprise.js): the catalog's, plus the movies and TV shows
// in TMDB's lists when TMDB is available (the same request Home and Search already make). `type` follows Home's
// TV Shows / Movies chips.
export function SurpriseButton({ type = null, className = 'ghost-cta surprise-button' }) {
  const t = useT()
  const navigate = useNavigate()
  const { titles, isAllowed } = useCatalog()
  const tmdbLists = useTmdbLists()
  const { reactions } = useLibrary()
  const [nothing, setNothing] = useState(false)

  const surprise = () => {
    // TMDB titles carry their US certification, so restricted profiles only get the ones within their setting
    const pool = tmdbLists ? [...titles, ...listedTitles(tmdbLists).filter(isAllowed)] : titles
    const pick = pickSurprise(pool, reactions, { type, previous })
    setNothing(!pick)
    if (!pick) return
    previous = pick.id
    navigate(pick.path ?? `/title/${pick.id}`)
  }

  return (
    <>
      <button type="button" className={className} onClick={surprise}><span aria-hidden="true">🎲</span> {t('Surprise me')}</button>
      {nothing && <p className="muted" role="status">{t('Nothing to pick for this profile right now.')}</p>}
    </>
  )
}
