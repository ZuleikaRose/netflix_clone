import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { useTmdbLists } from '../state/useTmdb.js'
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
const FEATURED_COUNT = 3
const TOP_COUNT = 10

const interleave = (lists) => Array.from({ length: Math.max(0, ...lists.map((l) => l.length)) }, (_, i) => lists.map((l) => l[i]))
  .flat().filter(Boolean)

export function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { myList, favorites, ratings, toggleMyList, dismissedNotices, dismissNotice } = useLibrary()
  const [type, setType] = useState(null)
  const [slide, setSlide] = useState(0)
  const { titles: catalog, isAllowed } = useCatalog()
  const tmdbLists = useTmdbLists()
  useDocumentTitle('Home')

  const titles = type ? catalog.filter((t) => t.type === type) : catalog
  // Outline: "a carousel of featured movies and TV shows" — manual controls only (no auto-advance, WCAG 2.2.2)
  const featuredList = [...titles].sort((a, b) => b.popularity - a.popularity).slice(0, FEATURED_COUNT)
  const current = featuredList.length ? slide % featuredList.length : 0
  const featured = featuredList[current]
  const showSlide = (i) => setSlide((i + featuredList.length) % featuredList.length)
  const notice = serviceStatus.notice && !dismissedNotices.includes(serviceStatus.notice.id) ? serviceStatus.notice : null
  const continueWatching = titles.filter((t) => t.progress)
  const saved = featured && myList.includes(featured.id)
  const preview = usePreview(featured ?? {})
  const [first, ...rest] = featured ? featured.title.toUpperCase().split(' ') : []
  // The TV Shows / Movies chips filter these too. TMDB list items have no certification ('NR'), so restricted
  // profiles don't see them
  const showsHere = (t) => (!type || t.type === type) && isAllowed(t)
  const tmdbRowsShown = tmdbLists
    ? tmdbRows
      .map(([heading, names]) => [heading, interleave(names.map((name) => tmdbLists[name] ?? [])).filter(showsHere)])
      .filter(([, titles]) => titles.length > 0)
    : []
  // The catalog's ranked titles first, then TMDB's trending movies and shows (alternating) up to ten, numbered by place
  const tmdbTrending = tmdbLists ? interleave([tmdbLists.trendingMovies ?? [], tmdbLists.trendingShows ?? []]).filter(showsHere) : []
  const top10 = [...titles.filter((t) => t.top10).sort((a, b) => a.top10 - b.top10), ...tmdbTrending].slice(0, TOP_COUNT)

  // Personalized row: seed from the most recent favorite, then 4★+ ratings, then My List
  const likedIds = [...[...favorites].reverse(), ...Object.keys(ratings).filter((id) => ratings[id] >= 4), ...[...myList].reverse()]
  // Respect the "Personalized recommendations" permission from Account
  const seed = user.preferences.personalized ? likedIds.map((id) => titles.find((t) => t.id === id)).find(Boolean) : null
  const sharedGenres = (t) => t.genres.filter((g) => seed.genres.includes(g)).length
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
          <Link to="/my-netflix" className="avatar-hit" aria-label="My Netflix profile"><span className="avatar" aria-hidden="true"><span /><span /><i /></span></Link>
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
        <PreviewArt title={featured} preview={preview} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow"><b>N</b> {featured.type === 'show' ? 'SERIES' : 'FILM'}</p>
          <h1 className="hero-title">{first}<br />{rest.join(' ')}</h1>
          <p className="meta">{featured.mood.join('  ·  ')}</p>
          <PreviewToggle title={featured} preview={preview} />
          <div className="hero-actions">
            <button className="play" onClick={() => navigate(`/title/${featured.id}?play=1`)}><span aria-hidden="true">▶</span> Play</button>
            <button className={saved ? 'secondary saved' : 'secondary'} aria-pressed={saved} onClick={() => toggleMyList(featured.id)}>
              <Icon name={saved ? 'check' : 'plus'} /> {saved ? 'Saved' : 'My List'}
            </button>
          </div>
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
          <Row title={`Continue Watching for ${user.name}`}>
            {continueWatching.map((t) => (
              <PosterCard key={t.id} title={t}>
                <Link to={`/title/${t.id}?play=1`} aria-label={`Resume ${t.title}`} className="resume"><span aria-hidden="true">▶</span></Link>
                <div className="progress"><span style={{ width: `${t.progress}%` }} /></div>
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
                <img src={t.image} alt="" style={{ filter: t.tint }} loading={t.source === 'tmdb' ? 'lazy' : undefined} />
                <b aria-hidden="true">TOP<br /><em>10</em></b>
              </Link>
            ))}
          </Row>
        )}

        {tmdbRowsShown.map(([heading, titles]) => (
          <Row key={heading} title={heading}>
            {titles.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        ))}
        {tmdbRowsShown.length > 0 && <TmdbCredit />}
      </div>
    </>
  )
}
