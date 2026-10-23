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
import { notDisliked, reactedWith } from '../data/reactions.js'
import { serviceStatus } from '../data/serviceStatus.js'
import { useAuth } from '../state/authContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import { SurpriseButton } from '../components/SurpriseButton.jsx'
import { useStoreTitle } from '../state/useStoreTitle.js'
import { useTmdbLists, useTmdbRecommendations } from '../state/useTmdb.js'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useT } from '../state/useT.js'

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
  const t = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { myList, favorites, ratings, reactions, progress, toggleMyList, dismissedNotices, dismissNotice } = useLibrary()
  const [type, setType] = useState(null)
  const [slide, setSlide] = useState(0)
  const { titles: catalog, isAllowed, findTitle } = useCatalog()
  const tmdbLists = useTmdbLists()
  const storeTitle = useStoreTitle()
  const [saveError, setSaveError] = useState(null)
  useDocumentTitle(t('Home'))

  const titles = type ? catalog.filter((t) => t.type === type) : catalog
  // The TV Shows / Movies chips filter TMDB's titles too. The tmdb function looks up each title's US certification,
  // so restricted profiles see the ones within their setting (titles TMDB has no rating for stay 'NR' and hidden)
  const showsHere = (t) => (!type || t.type === type) && isAllowed(t)
  // Recommendation rows leave out titles the profile marked Not for me (Top 10 and Continue Watching keep them)
  const recommendable = notDisliked(reactions)
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
    .map(([heading, names]) => [heading, fromTmdb(names).filter(recommendable)])
    .filter(([, titles]) => titles.length > 0)
  // TMDB's ten trending movies and shows (alternating), numbered by place; the catalog's ranked titles when TMDB
  // isn't available
  const tmdbTop = fromTmdb(['trendingMovies', 'trendingShows'])
  const top10 = (tmdbTop.length ? tmdbTop : titles.filter((t) => t.top10).sort((a, b) => a.top10 - b.top10)).slice(0, TOP_COUNT)
  // My List on the hero: a TMDB title is stored first (lists point at `titles` rows)
  const toggleFeaturedOnList = async () => {
    setSaveError(null)
    if (!saved && !(await storeTitle(featured))) return setSaveError(t('Couldn’t save this title. Please try again.'))
    toggleMyList(featured.id)
  }

  // Personalized row: seed from the latest Love this!, then the most recent favorite, I like this, 4★+ ratings, then
  // My List (never a title marked Not for me)
  const likedIds = [
    ...reactedWith(reactions, 'love'), ...[...favorites].reverse(), ...reactedWith(reactions, 'like'),
    ...Object.keys(ratings).filter((id) => ratings[id] >= 4), ...[...myList].reverse(),
  ].filter((id) => reactions[id] !== 'dislike')
  // Respect the "Personalized recommendations" permission from Account
  const seed = user.preferences.personalized ? likedIds.map((id) => titles.find((t) => t.id === id)).find(Boolean) : null
  const sharedGenres = (t) => t.genres.filter((g) => seed.genres.includes(g)).length
  // Because You Saved: TMDB's recommendations for the TMDB title most recently loved or liked, else favorited or saved
  const savedTmdb = user.preferences.personalized
    ? [...reactedWith(reactions, 'love', 'like'), ...[...favorites].reverse(), ...[...myList].reverse()].map(findTitle)
      .find((t) => t?.source === 'tmdb' && t.tmdbId && reactions[t.id] !== 'dislike')
    : null
  const recommended = useTmdbRecommendations(savedTmdb?.type, savedTmdb?.tmdbId)
  const becauseYouSaved = (recommended ?? [])
    .filter((t) => showsHere(t) && recommendable(t) && t.id !== savedTmdb?.id && !myList.includes(t.id) && !favorites.includes(t.id))
  const becauseYouLiked = seed
    ? titles.filter((t) => t.id !== seed.id && recommendable(t) && !myList.includes(t.id) && sharedGenres(t) > 0)
      .sort((a, b) => sharedGenres(b) - sharedGenres(a) || b.popularity - a.popularity)
    : []

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label={t('Home')}><Logo size={34} /></Link>
        <div className="top-actions">
          <AccessibilityButton />
          <Link to="/search" className="icon-button" aria-label={t('Search')}><Icon name="search" /></Link>
          <NotificationBell />
          <Link to="/my-netflix" className="avatar-hit" aria-label={t('My App profile')}><ProfileAvatar profile={profile} /></Link>
        </div>
      </header>

      <section className="filters" aria-label={t('Browse filters')}>
        {filters.map(([label, value]) => (
          <button key={value} className={type === value ? 'chip active' : 'chip'} aria-pressed={type === value} onClick={() => { setType(type === value ? null : value); setSlide(0) }}>{t(label)}</button>
        ))}
        <button className="chip" onClick={() => navigate('/search')}>{t('Categories')} <span aria-hidden="true">⌄</span></button>
        <Link to="/what-to-watch" className="chip">{t('What should I watch?')}</Link>
      </section>

      {notice && (
        <aside className="service-banner" role="status" aria-label={t('Service notice')}>
          <p><b>{t(notice.title)}:</b> {t(notice.message)}</p>
          <button type="button" className="icon-button" aria-label={t('Dismiss notice')} onClick={() => dismissNotice(notice.id)}><Icon name="close" /></button>
        </aside>
      )}

      {!featured && (
        <div className="empty home-empty">
          <p>{t('Nothing here for this profile’s maturity setting.')}</p>
          <Link to="/account" className="play wide">{t('Change in Account')}</Link>
        </div>
      )}

      {featured && <section className="hero" aria-roledescription="carousel" aria-label={t('Featured titles')}>
        <PreviewArt title={{ ...featured, image: heroImage(featured) }} preview={preview} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">{featuredIsTmdb ? null : <b>N</b>} {featured.type === 'show' ? t('SERIES') : t('FILM')}{featuredIsTmdb && ' · TMDB'}</p>
          <h1 className="hero-title">{first}<br />{rest.join(' ')}</h1>
          <p className="meta">{(featuredIsTmdb ? featured.genres.slice(0, 3) : featured.mood).join('  ·  ')}</p>
          <PreviewToggle title={featured} preview={preview} />
          <div className="hero-actions">
            {featuredIsTmdb
              // TMDB titles can't be played here; their page has the trailer and where to watch
              ? <Link to={featured.path} className="play"><Icon name="info" /> {t('More Info')}</Link>
              : <button className="play" onClick={() => navigate(`/title/${featured.id}?play=1`)}><span aria-hidden="true">▶</span> {t('Play')}</button>}
            <button className={saved ? 'secondary saved' : 'secondary'} aria-pressed={saved} onClick={toggleFeaturedOnList}>
              <Icon name={saved ? 'check' : 'plus'} /> {saved ? t('Saved') : t('My List')}
            </button>
          </div>
          {saveError && <p className="form-alert" role="alert">{saveError}</p>}
          {featuredList.length > 1 && (
            <div className="carousel-controls">
              <button type="button" className="carousel-arrow" aria-label={t('Previous featured title')} onClick={() => showSlide(current - 1)}><Icon name="back" /></button>
              <div className="carousel-dots">
                {featuredList.map((item, i) => (
                  <button key={item.id} type="button" className={i === current ? 'dot-btn active' : 'dot-btn'} aria-label={t('Show {title}', { title: item.title })} aria-current={i === current} onClick={() => showSlide(i)} />
                ))}
              </div>
              <button type="button" className="carousel-arrow" aria-label={t('Next featured title')} onClick={() => showSlide(current + 1)}><Icon name="chevron" /></button>
            </div>
          )}
          <p className="sr-only" aria-live="polite">{t('Featured {number} of {count}: {title}', { number: current + 1, count: featuredList.length, title: featured.title })}</p>
        </div>
      </section>}

      <div className="content">
        {/* A random title for the profile (following the TV Shows / Movies chip) */}
        {titles.length > 0 && <div className="surprise-row"><SurpriseButton type={type} /></div>}

        {continueWatching.length > 0 && (
          <Row title={t('Continue Watching for {name}', { name: profile.name })}>
            {continueWatching.map((item) => (
              <PosterCard key={item.id} title={item}>
                <Link to={`/title/${item.id}?play=1`} aria-label={t('Resume {title}', { title: item.title })} className="resume"><span aria-hidden="true">▶</span></Link>
                <div className="progress"><span style={{ width: `${progress[item.id].percent}%` }} /></div>
                {item.type === 'show' && progress[item.id].episode > 1 && <span className="episode-badge">E{progress[item.id].episode}</span>}
              </PosterCard>
            ))}
          </Row>
        )}

        {becauseYouLiked.length > 0 && (
          <Row title={t('Because You Liked {title}', { title: seed.title })}>
            {becauseYouLiked.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        )}

        {top10.length > 0 && (
          <Row title={t('Top 10 in the U.S. Today')} className="ranking">
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
          <Row title={t('Because You Saved {title}', { title: savedTmdb.title })}>
            {becauseYouSaved.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        )}

        {tmdbRowsShown.map(([heading, titles]) => (
          <Row key={heading} title={t(heading)}>
            {titles.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        ))}
        {(featuredIsTmdb || top10.some((t) => t.source === 'tmdb') || tmdbRowsShown.length > 0 || becauseYouSaved.length > 0) && <TmdbCredit />}
      </div>
    </>
  )
}
