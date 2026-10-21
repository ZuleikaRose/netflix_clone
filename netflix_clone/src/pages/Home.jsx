import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NotificationBell } from '../components/NotificationBell.jsx'
import { Logo } from '../components/Logo.jsx'
import { Icon } from '../components/Icon.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { PosterCard } from '../components/PosterCard.jsx'
import { Row } from '../components/Row.jsx'
import { PreviewArt, PreviewToggle } from '../components/Preview.jsx'
import { usePreview } from '../components/usePreview.js'
import { AccessibilityButton } from '../components/AccessibilityButton.jsx'
import { serviceStatus } from '../data/serviceStatus.js'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { useStoreTitle } from '../state/useStoreTitle.js'
import { useTmdbLists, useTmdbRecommendations } from '../state/useTmdb.js'
import { TmdbCredit } from '../components/TmdbCredit.jsx'

const filters = [['TV Shows', 'show'], ['Movies', 'movie']]
// Rows from TMDB, below the catalog's own rows: [row heading, lists from the tmdb function]. A row built from two
// lists alternates between them (a new movie, then a new show…).
const tmdbRows = [
  ['New on TMDB', ['newMovies', 'newShows']],
  ['Trending Movies on TMDB', ['trendingMovies']],
  ['Trending TV Shows on TMDB', ['trendingShows']],
  ['Popular Movies on TMDB', ['popularMovies']],
  ['Popular TV Shows on TMDB', ['popularShows']],
]
const FEATURED_COUNT = 5
// TMDB posters come at w342 for rows; the full-height hero needs a sharper one
const heroImage = (t) => (t.source === 'tmdb' ? t.image?.replace('/w342/', '/w780/') : t.image)
const TOP_COUNT = 10

const interleave = (lists) => Array.from({ length: Math.max(0, ...lists.map((l) => l.length)) }, (_, i) => lists.map((l) => l[i]))
  .flat().filter(Boolean)

export function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { myList, favorites, ratings, progress, toggleMyList, dismissedNotices, dismissNotice } = useLibrary()
  const [type, setType] = useState(null)
  const [slide, setSlide] = useState(0)
  const { titles: catalog, isAllowed, findTitle } = useCatalog()
  const tmdbLists = useTmdbLists()
  const storeTitle = useStoreTitle()
  const [saveError, setSaveError] = useState(null)
  useDocumentTitle('Home')

  const titles = type ? catalog.filter((t) => t.type === type) : catalog
  // The TV Shows / Movies chips filter TMDB's titles too. The tmdb function looks up each title's US certification,
  // so restricted profiles see the ones within their setting (titles TMDB has no rating for stay 'NR' and hidden)
  const showsHere = (t) => (!type || t.type === type) && isAllowed(t)
  const fromTmdb = (names) => (tmdbLists ? interleave(names.map((name) => tmdbLists[name] ?? [])).filter(showsHere) : [])
  // Outline: "a carousel of featured movies and TV shows" — TMDB's popular movies and shows (alternating), or the
  // catalog's most popular titles when TMDB isn't available. Manual controls only (no auto-advance, WCAG 2.2.2)
  const tmdbFeatured = fromTmdb(['popularMovies', 'popularShows']).slice(0, FEATURED_COUNT)
  const featuredList = tmdbFeatured.length
    ? tmdbFeatured
    : [...titles].sort((a, b) => b.popularity - a.popularity).slice(0, FEATURED_COUNT)
  const current = featuredList.length ? slide % featuredList.length : 0
  const featured = featuredList[current]
  const showSlide = (i) => setSlide((i + featuredList.length) % featuredList.length)
  const notice = serviceStatus.notice && !dismissedNotices.includes(serviceStatus.notice.id) ? serviceStatus.notice : null
  // Most recently watched first (LibraryProvider keeps progress newest first)
  const continueWatching = Object.keys(progress).map((id) => titles.find((t) => t.id === id)).filter(Boolean)
  const saved = featured && myList.includes(featured.id)
  const preview = usePreview(featured ?? {})
  const [first, ...rest] = featured ? featured.title.toUpperCase().split(' ') : []
  const featuredIsTmdb = featured?.source === 'tmdb'
  const tmdbRowsShown = tmdbRows
    .map(([heading, names]) => [heading, fromTmdb(names)])
    .filter(([, titles]) => titles.length > 0)
  // TMDB's ten trending movies and shows (alternating), numbered by place; the catalog's ranked titles when TMDB
  // isn't available
  const tmdbTop = fromTmdb(['trendingMovies', 'trendingShows'])
  const top10 = (tmdbTop.length ? tmdbTop : titles.filter((t) => t.top10).sort((a, b) => a.top10 - b.top10)).slice(0, TOP_COUNT)
  // My List on the hero: a TMDB title is stored first (lists point at `titles` rows)
  const toggleFeaturedOnList = async () => {
    setSaveError(null)
    if (!saved && !(await storeTitle(featured))) return setSaveError('Couldn’t save this title. Please try again.')
    toggleMyList(featured.id)
  }

  // Personalized row: seed from the most recent favorite, then 4★+ ratings, then My List
  const likedIds = [...[...favorites].reverse(), ...Object.keys(ratings).filter((id) => ratings[id] >= 4), ...[...myList].reverse()]
  // Respect the "Personalized recommendations" permission from Account
  const seed = user.preferences.personalized ? likedIds.map((id) => titles.find((t) => t.id === id)).find(Boolean) : null
  const sharedGenres = (t) => t.genres.filter((g) => seed.genres.includes(g)).length
  // Because You Saved: TMDB's recommendations for the TMDB title most recently added to Favorites or My List
  const savedTmdb = user.preferences.personalized
    ? [...[...favorites].reverse(), ...[...myList].reverse()].map(findTitle).find((t) => t?.source === 'tmdb' && t.tmdbId)
    : null
  const recommended = useTmdbRecommendations(savedTmdb?.type, savedTmdb?.tmdbId)
  const becauseYouSaved = (recommended ?? [])
    .filter((t) => showsHere(t) && t.id !== savedTmdb?.id && !myList.includes(t.id) && !favorites.includes(t.id))
  const becauseYouLiked = seed
    ? titles.filter((t) => t.id !== seed.id && !myList.includes(t.id) && sharedGenres(t) > 0)
      .sort((a, b) => sharedGenres(b) - sharedGenres(a) || b.popularity - a.popularity)
    : []

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Home"><Logo size={34} /></Link>
        <div className="top-actions">
          <AccessibilityButton />
          <Link to="/search" className="icon-button" aria-label="Search"><Icon name="search" /></Link>
          <NotificationBell />
          <Link to="/my-netflix" className="avatar-hit" aria-label="My Netflix profile"><ProfileAvatar profile={profile} /></Link>
        </div>
      </header>

      <section className="filters" aria-label="Browse filters">
        {filters.map(([label, value]) => (
          <button key={value} className={type === value ? 'chip active' : 'chip'} aria-pressed={type === value} onClick={() => { setType(type === value ? null : value); setSlide(0) }}>{label}</button>
        ))}
        <button className="chip" onClick={() => navigate('/search')}>Categories <span aria-hidden="true">⌄</span></button>
      </section>

      {notice && (
        <aside className="service-banner" role="status" aria-label="Service notice">
          <p><b>{notice.title}:</b> {notice.message}</p>
          <button type="button" className="icon-button" aria-label="Dismiss notice" onClick={() => dismissNotice(notice.id)}><Icon name="close" /></button>
        </aside>
      )}

      {!featured && (
        <div className="empty home-empty">
          <p>Nothing here for this profile’s maturity setting.</p>
          <Link to="/account" className="play wide">Change in Account</Link>
        </div>
      )}

      {featured && <section className="hero" aria-roledescription="carousel" aria-label="Featured titles">
        <PreviewArt title={{ ...featured, image: heroImage(featured) }} preview={preview} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">{featuredIsTmdb ? null : <b>N</b>} {featured.type === 'show' ? 'SERIES' : 'FILM'}{featuredIsTmdb && ' · TMDB'}</p>
          <h1 className="hero-title">{first}<br />{rest.join(' ')}</h1>
          <p className="meta">{(featuredIsTmdb ? featured.genres.slice(0, 3) : featured.mood).join('  ·  ')}</p>
          <PreviewToggle title={featured} preview={preview} />
          <div className="hero-actions">
            {featuredIsTmdb
              // TMDB titles can't be played here; their page has the trailer and where to watch
              ? <Link to={featured.path} className="play"><Icon name="info" /> More Info</Link>
              : <button className="play" onClick={() => navigate(`/title/${featured.id}?play=1`)}><span aria-hidden="true">▶</span> Play</button>}
            <button className={saved ? 'secondary saved' : 'secondary'} aria-pressed={saved} onClick={toggleFeaturedOnList}>
              <Icon name={saved ? 'check' : 'plus'} /> {saved ? 'Saved' : 'My List'}
            </button>
          </div>
          {saveError && <p className="form-alert" role="alert">{saveError}</p>}
          {featuredList.length > 1 && (
            <div className="carousel-controls">
              <button type="button" className="carousel-arrow" aria-label="Previous featured title" onClick={() => showSlide(current - 1)}><Icon name="back" /></button>
              <div className="carousel-dots">
                {featuredList.map((t, i) => (
                  <button key={t.id} type="button" className={i === current ? 'dot-btn active' : 'dot-btn'} aria-label={`Show ${t.title}`} aria-current={i === current} onClick={() => showSlide(i)} />
                ))}
              </div>
              <button type="button" className="carousel-arrow" aria-label="Next featured title" onClick={() => showSlide(current + 1)}><Icon name="chevron" /></button>
            </div>
          )}
          <p className="sr-only" aria-live="polite">Featured {current + 1} of {featuredList.length}: {featured.title}</p>
        </div>
      </section>}

      <div className="content">
        {continueWatching.length > 0 && (
          <Row title={`Continue Watching for ${profile.name}`}>
            {continueWatching.map((t) => (
              <PosterCard key={t.id} title={t}>
                <Link to={`/title/${t.id}?play=1`} aria-label={`Resume ${t.title}`} className="resume"><span aria-hidden="true">▶</span></Link>
                <div className="progress"><span style={{ width: `${progress[t.id].percent}%` }} /></div>
                {t.type === 'show' && progress[t.id].episode > 1 && <span className="episode-badge">E{progress[t.id].episode}</span>}
              </PosterCard>
            ))}
          </Row>
        )}

        {becauseYouLiked.length > 0 && (
          <Row title={`Because You Liked ${seed.title}`}>
            {becauseYouLiked.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        )}

        {top10.length > 0 && (
          <Row title="Top 10 in the U.S. Today" className="ranking">
            {top10.map((t, i) => (
              <Link to={t.path ?? `/title/${t.id}`} className={i + 1 >= 10 ? 'rank-card two-digits' : 'rank-card'} key={t.id} aria-label={`#${i + 1}: ${t.title}`}>
                <span aria-hidden="true">{i + 1}</span>
                <img src={t.image} alt="" style={{ filter: t.tint }} loading={t.source === 'tmdb' && i > 2 ? 'lazy' : undefined} />
                <b aria-hidden="true">TOP<br /><em>10</em></b>
              </Link>
            ))}
          </Row>
        )}

        {becauseYouSaved.length > 0 && (
          <Row title={`Because You Saved ${savedTmdb.title}`}>
            {becauseYouSaved.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        )}

        {tmdbRowsShown.map(([heading, titles]) => (
          <Row key={heading} title={heading}>
            {titles.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        ))}
        {(featuredIsTmdb || top10.some((t) => t.source === 'tmdb') || tmdbRowsShown.length > 0 || becauseYouSaved.length > 0) && <TmdbCredit />}
      </div>
    </>
  )
}
