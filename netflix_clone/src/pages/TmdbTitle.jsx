import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength } from '../data/catalog.js'
import { useCatalog } from '../state/useCatalog.js'
import { useTmdbTitle } from '../state/useTmdb.js'
import { NotFound } from './NotFound.jsx'

// A movie or TV show from TMDB (/tmdb/movie/:tmdbId, /tmdb/show/:tmdbId). It isn't in the catalog, so there's no
// player, My List or reviews here — only TMDB's details and a link to its page.
export function TmdbTitle() {
  const { type, tmdbId } = useParams()
  const validId = (type === 'movie' || type === 'show') && /^\d+$/.test(tmdbId)
  const { status, title } = useTmdbTitle(validId ? type : null, validId ? tmdbId : null)
  const { isAllowed } = useCatalog()
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
