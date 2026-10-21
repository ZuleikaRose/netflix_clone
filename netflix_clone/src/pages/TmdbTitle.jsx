import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CreditLinks } from '../components/CreditLinks.jsx'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { Reviews } from '../components/Reviews.jsx'
import { Row } from '../components/Row.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength } from '../data/catalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useStoreTitle } from '../state/useStoreTitle.js'
import { useTmdbRecommendations, useTmdbTitle } from '../state/useTmdb.js'
import { NotFound } from './NotFound.jsx'

// A movie or TV show from TMDB (/tmdb/movie/:tmdbId, /tmdb/show/:tmdbId): TMDB's details and trailer, where to
// watch it, My List / Favorite, ratings and reviews, and TMDB's recommendations. There's no player (no sample clip).
const JUSTWATCH_URL = 'https://www.justwatch.com'
const providerKinds = [['stream', 'Stream'], ['rent', 'Rent'], ['buy', 'Buy']]

function WhereToWatch({ title }) {
  const { providers } = title
  return (
    <section className="providers" aria-labelledby="providers-heading">
      <h3 id="providers-heading">Where to watch in the U.S.</h3>
      {!providers
        ? <p className="muted">No streaming, rental or purchase options are listed for {title.title} right now.</p>
        : (
          <>
            {providerKinds.filter(([kind]) => providers[kind].length > 0).map(([kind, label]) => (
              <div key={kind} className="provider-group">
                <h4>{label}</h4>
                <ul className="provider-list">
                  {providers[kind].map((p) => (
                    <li key={p.name}>{p.logo && <img src={p.logo} alt="" loading="lazy" />}<span>{p.name}</span></li>
                  ))}
                </ul>
              </div>
            ))}
            {providers.link && <p><a href={providers.link} className="inline-link" target="_blank" rel="noreferrer">See every option on TMDB</a></p>}
          </>
        )}
      <p className="tmdb-credit">Availability from <a href={JUSTWATCH_URL} target="_blank" rel="noreferrer">JustWatch</a>.</p>
    </section>
  )
}

function Trailer({ title, onClose }) {
  return (
    <div className="trailer">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${title.trailer.key}?autoplay=1&rel=0`}
        title={`${title.title} trailer`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button type="button" className="icon-button player-close" aria-label="Close trailer" onClick={onClose}><Icon name="close" /></button>
    </div>
  )
}
const tmdbPerson = (p) => ({ key: p.id, name: p.name, to: `/tmdb/person/${p.id}` })
const directs = (p) => p.job === 'Director' || p.job === 'Creator'

// Cast and crew, each name linking to their TMDB person page (plain names if the answer has no ids)
function Credits({ title }) {
  const directing = title.type === 'show' ? 'Created by' : 'Director'
  if (!title.people) {
    return (
      <>
        {title.cast.length > 0 && <p className="credits"><span>Starring:</span> {title.cast.join(', ')}</p>}
        {title.crew.director && <p className="credits"><span>{directing}:</span> {title.crew.director}</p>}
        {title.crew.writer && <p className="credits"><span>Writer:</span> {title.crew.writer}</p>}
      </>
    )
  }
  const { cast, crew } = title.people
  return (
    <>
      <CreditLinks label="Starring" people={cast.map(tmdbPerson)} />
      <CreditLinks label={directing} people={crew.filter(directs).map(tmdbPerson)} />
      <CreditLinks label="Writer" people={crew.filter((p) => !directs(p)).map(tmdbPerson)} />
    </>
  )
}

export function TmdbTitle() {
  const { type, tmdbId } = useParams()
  const validId = (type === 'movie' || type === 'show') && /^\d+$/.test(tmdbId)
  const { status, title } = useTmdbTitle(validId ? type : null, validId ? tmdbId : null)
  const recommended = useTmdbRecommendations(status === 'ready' ? type : null, status === 'ready' ? tmdbId : null)
  const [watchingTrailer, setWatchingTrailer] = useState(false)
  const { isAllowed } = useCatalog()
  const store = useStoreTitle()
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
  // Lists, ratings and reviews point at `titles` rows: with Supabase, the tmdb function stores the title first
  const storeTitle = () => store(title)
  const keep = async (toggle, isOn) => {
    setSaveError(null)
    if (!isOn && !(await storeTitle())) {
      setSaveError('Couldn’t save this title. Please try again.')
      return
    }
    toggle(title.id)
  }
  const moreLikeThis = (recommended ?? []).filter(isAllowed)
  return (
    <>
      <PageHeader title={heading} back />
      {watchingTrailer && title.trailer
        ? <Trailer title={title} onClose={() => setWatchingTrailer(false)} />
        : (
          <div className="detail-art">
            <img src={title.backdrop ?? title.image} alt="" />
            <div className="hero-shade" />
          </div>
        )}

      <div className="detail-body">
        <p className="eyebrow">{title.type === 'show' ? 'SERIES' : 'FILM'} · TMDB</p>
        <h2 className="detail-title">{title.title.toUpperCase()}</h2>
        <p className="detail-meta">
          {title.year && <span>{title.year}</span>}
          <span className="maturity">{title.maturity}</span>
          {length && <span>{length}</span>}
          {title.rating != null && <span>TMDB rating {title.rating}/10</span>}
        </p>
        <p className="muted">Not available to stream here (see where to watch below). <a href={title.tmdbUrl} className="inline-link" target="_blank" rel="noreferrer">View {title.title} on TMDB</a></p>

        <div className="detail-actions">
          {title.trailer && !watchingTrailer && (
            <button type="button" className="play wide" onClick={() => setWatchingTrailer(true)}><span aria-hidden="true">▶</span> Play trailer</button>
          )}
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
        <Credits title={title} />
        {title.genres.length > 0 && <p className="credits"><span>Genres:</span> {title.genres.join(', ')}</p>}

        <WhereToWatch title={title} />
        <Reviews title={title} beforeSave={storeTitle} />
        <TmdbCredit />
      </div>

      {moreLikeThis.length > 0 && (
        <Row title="More Like This">{moreLikeThis.map((t) => <PosterCard key={t.id} title={t} />)}</Row>
      )}
    </>
  )
}
