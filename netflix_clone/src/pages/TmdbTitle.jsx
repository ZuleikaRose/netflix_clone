import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength } from '../data/catalog.js'
import { saveTmdbTitle } from '../data/tmdbApi.js'
import { authBackend } from '../lib/supabaseConfig.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useTmdbTitle } from '../state/useTmdb.js'
import { NotFound } from './NotFound.jsx'

// A movie or TV show from TMDB (/tmdb/movie/:tmdbId, /tmdb/show/:tmdbId): TMDB's details, a link to its page, and
// My List / Favorite. There's no player or reviews (no sample clip; reviews are for the catalog).
export function TmdbTitle() {
  const { type, tmdbId } = useParams()
  const validId = (type === 'movie' || type === 'show') && /^\d+$/.test(tmdbId)
  const { status, title } = useTmdbTitle(validId ? type : null, validId ? tmdbId : null)
  const { isAllowed, rememberTitle } = useCatalog()
  const { myList, favorites, toggleMyList, toggleFavorite } = useLibrary()
  const [saveError, setSaveError] = useState(null)
  useDocumentTitle(title?.title)

  if (!validId || status === 'missing') return <NotFound />
  const heading = type === 'show' ? 'TV Show' : 'Movie'
  if (status !== 'ready') {
    return (
      <>
        <PageHeader title={heading} back />
        <div className="empty" role="status">
          <p>{status === 'loading' ? 'Loading from TMDB…' : 'TMDB isn’t available right now. Please try again later.'}</p>
        </div>
      </>
    )
  }
  if (!isAllowed(title)) {
    return (
      <>
        <PageHeader title="Restricted" back />
        <div className="empty">
          <p>{title.title} is {title.maturity === 'NR' ? 'not rated' : `rated ${title.maturity}`}, which is above this profile’s maturity setting.</p>
          <Link to="/account" className="play wide">Change in Account</Link>
        </div>
      </>
    )
  }

  const length = describeLength(title)
  const saved = myList.includes(title.id)
  const favorite = favorites.includes(title.id)
  // Lists point at `titles` rows: with Supabase, the tmdb function stores the title before it's first added
  const keep = async (toggle, isOn) => {
    setSaveError(null)
    if (!isOn && authBackend === 'supabase' && !(await saveTmdbTitle(title))) {
      setSaveError('Couldn’t save this title. Please try again.')
      return
    }
    rememberTitle(title)
    toggle(title.id)
  }
  return (
    <>
      <PageHeader title={heading} back />
      <div className="detail-art">
        <img src={title.backdrop ?? title.image} alt="" />
        <div className="hero-shade" />
      </div>

      <div className="detail-body">
        <p className="eyebrow">{title.type === 'show' ? 'SERIES' : 'FILM'} · TMDB</p>
        <h2 className="detail-title">{title.title.toUpperCase()}</h2>
        <p className="detail-meta">
          {title.year && <span>{title.year}</span>}
          <span className="maturity">{title.maturity}</span>
          {length && <span>{length}</span>}
          {title.rating != null && <span>TMDB rating {title.rating}/10</span>}
        </p>
        <p className="muted">Not available to stream here. <a href={title.tmdbUrl} className="inline-link" target="_blank" rel="noreferrer">View {title.title} on TMDB</a></p>

        <div className="detail-actions">
          <div className="action-row">
            <button className={saved ? 'ghost-action on' : 'ghost-action'} aria-pressed={saved} onClick={() => keep(toggleMyList, saved)}>
              <Icon name={saved ? 'check' : 'plus'} /><span>My List</span>
            </button>
            <button className={favorite ? 'ghost-action on' : 'ghost-action'} aria-pressed={favorite} onClick={() => keep(toggleFavorite, favorite)}>
              <Icon name="heart" filled={favorite} /><span>Favorite</span>
            </button>
          </div>
          {saveError && <p className="form-alert" role="alert">{saveError}</p>}
        </div>

        <p className="synopsis">{title.synopsis}</p>
        {title.cast.length > 0 && <p className="credits"><span>Starring:</span> {title.cast.join(', ')}</p>}
        {title.crew.director && <p className="credits"><span>{title.type === 'show' ? 'Created by' : 'Director'}:</span> {title.crew.director}</p>}
        {title.crew.writer && <p className="credits"><span>Writer:</span> {title.crew.writer}</p>}
        {title.genres.length > 0 && <p className="credits"><span>Genres:</span> {title.genres.join(', ')}</p>}
        <TmdbCredit />
      </div>
    </>
  )
}
