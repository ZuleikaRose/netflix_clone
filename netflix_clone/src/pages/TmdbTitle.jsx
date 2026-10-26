import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AddToList } from '../components/AddToList.jsx'
import { CreditLinks } from '../components/CreditLinks.jsx'
import { Episodes } from '../components/Episodes.jsx'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { Reviews } from '../components/Reviews.jsx'
import { Row } from '../components/Row.jsx'
import { TitleReaction } from '../components/TitleReaction.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength } from '../data/catalog.js'
import { formatReleaseDay, localDay } from '../data/notifications.js'
import { notDisliked } from '../data/reactions.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { useReminder } from '../state/useReminder.js'
import { useStoreTitle } from '../state/useStoreTitle.js'
import { useTmdbRecommendations, useTmdbSeason, useTmdbTitle } from '../state/useTmdb.js'
import { genreLabels } from '../data/tmdbApi.js'
import { NotFound } from './NotFound.jsx'
import { locale, tr } from '../i18n/index.js'
import { useT } from '../state/useT.js'

// A movie or TV show from TMDB (/tmdb/movie/:tmdbId, /tmdb/show/:tmdbId): TMDB's details and trailer, where to
// watch it, My List / Favorite, ratings and reviews, and TMDB's recommendations. There's no player (no sample clip).
const JUSTWATCH_URL = 'https://www.justwatch.com'
const providerKinds = [['stream', 'Stream'], ['rent', 'Rent'], ['buy', 'Buy']]

function WhereToWatch({ title }) {
  const t = useT()
  const { providers } = title
  return (
    <section className="providers" aria-labelledby="providers-heading">
      <h3 id="providers-heading">{t('Where to watch in the U.S.')}</h3>
      {!providers
        ? <p className="muted">{t('No streaming, rental or purchase options are listed for {title} right now.', { title: title.title })}</p>
        : (
          <>
            {providerKinds.filter(([kind]) => providers[kind].length > 0).map(([kind, label]) => (
              <div key={kind} className="provider-group">
                <h4>{t(label)}</h4>
                <ul className="provider-list">
                  {providers[kind].map((p) => (
                    <li key={p.name}>{p.logo && <img src={p.logo} alt="" loading="lazy" />}<span>{p.name}</span></li>
                  ))}
                </ul>
              </div>
            ))}
            {providers.link && <p><a href={providers.link} className="inline-link" target="_blank" rel="noreferrer">{t('See every option on TMDB')}</a></p>}
          </>
        )}
      <p className="tmdb-credit">{t('Availability from')} <a href={JUSTWATCH_URL} target="_blank" rel="noreferrer">JustWatch</a>.</p>
    </section>
  )
}

function Trailer({ title, onClose }) {
  const t = useT()
  return (
    <div className="trailer">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${title.trailer.key}?autoplay=1&rel=0`}
        title={t('{title} trailer', { title: title.title })}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button type="button" className="icon-button player-close" aria-label={t('Close trailer')} onClick={onClose}><Icon name="close" /></button>
    </div>
  )
}
const seasonStatus = { loading: 'Loading episodes…', unavailable: 'Episodes couldn’t be loaded from TMDB. Please try again later.', missing: 'TMDB has no episodes for this season.' }
const formatAirDate = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(locale(), { dateStyle: 'medium' })

// A TMDB show's episodes, loaded a season at a time (there's no player: TMDB titles can't be watched here)
function TmdbEpisodes({ title }) {
  const t = useT()
  const [number, setNumber] = useState(title.seasonList[0].number)
  const { status, season } = useTmdbSeason(title.tmdbId, number)
  return (
    <Episodes
      title={title.title}
      seasons={title.seasonList.map((s) => ({ number: s.number, label: s.name }))}
      season={number}
      onSeason={setNumber}
      status={status === 'ready' ? null : t(seasonStatus[status])}
      episodes={season?.episodes.map((e) => ({
        key: e.number,
        code: `E${e.number}`,
        name: e.name,
        meta: [e.airDate && formatAirDate(e.airDate), e.runtime].filter(Boolean).join(' · '),
        synopsis: e.overview,
        still: e.still,
      })) ?? null}
    />
  )
}

// A movie that isn't out yet, or a show's next episode: { day, label } for Remind Me, else null
function upcomingRelease(title) {
  const today = localDay()
  if (title.type === 'movie' && title.releaseDate > today) return { day: title.releaseDate, label: tr('In theaters {date}', { date: formatReleaseDay(title.releaseDate) }) }
  const next = title.nextEpisode
  if (next?.airDate >= today) {
    const episode = `S${next.season}:E${next.number}${next.name ? ` ${next.name}` : ''}`
    return { day: next.airDate, label: tr('{episode} airs {date}', { episode, date: formatReleaseDay(next.airDate) }) }
  }
  return null
}

const tmdbPerson = (p) => ({ key: p.id, name: p.name, to: `/tmdb/person/${p.id}` })
const directs = (p) => p.job === 'Director' || p.job === 'Creator'

// Cast and crew, each name linking to their TMDB person page (plain names if the answer has no ids)
function Credits({ title }) {
  const t = useT()
  const directing = title.type === 'show' ? t('Created by') : t('Director')
  if (!title.people) {
    return (
      <>
        {title.cast.length > 0 && <p className="credits"><span>{t('Starring')}:</span> {title.cast.join(', ')}</p>}
        {title.crew.director && <p className="credits"><span>{directing}:</span> {title.crew.director}</p>}
        {title.crew.writer && <p className="credits"><span>{t('Writer')}:</span> {title.crew.writer}</p>}
      </>
    )
  }
  const { cast, crew } = title.people
  return (
    <>
      <CreditLinks label={t('Starring')} people={cast.map(tmdbPerson)} />
      <CreditLinks label={directing} people={crew.filter(directs).map(tmdbPerson)} />
      <CreditLinks label={t('Writer')} people={crew.filter((p) => !directs(p)).map(tmdbPerson)} />
    </>
  )
}

export function TmdbTitle() {
  const t = useT()
  const { type, tmdbId } = useParams()
  const validId = (type === 'movie' || type === 'show') && /^\d+$/.test(tmdbId)
  const { status, title } = useTmdbTitle(validId ? type : null, validId ? tmdbId : null)
  const recommended = useTmdbRecommendations(status === 'ready' ? type : null, status === 'ready' ? tmdbId : null)
  const [watchingTrailer, setWatchingTrailer] = useState(false)
  const { isAllowed } = useCatalog()
  const store = useStoreTitle()
  const { myList, favorites, reactions, toggleMyList, toggleFavorite } = useLibrary()
  const [saveError, setSaveError] = useState(null)
  const reminder = useReminder()
  useDocumentTitle(title?.title)

  if (!validId || status === 'missing') return <NotFound />
  const heading = type === 'show' ? t('TV Show') : t('Movie')
  if (status !== 'ready') {
    return (
      <>
        <PageHeader title={heading} back />
        <div className="empty" role="status">
          <p>{status === 'loading' ? t('Loading from TMDB…') : t('TMDB isn’t available right now. Please try again later.')}</p>
        </div>
      </>
    )
  }
  if (!isAllowed(title)) {
    return (
      <>
        <PageHeader title={t('Restricted')} back />
        <div className="empty">
          <p>{title.maturity === 'NR'
            ? t('{title} is not rated, which is above this profile’s maturity setting.', { title: title.title })
            : t('{title} is rated {rating}, which is above this profile’s maturity setting.', { title: title.title, rating: title.maturity })}</p>
          <Link to="/account" className="play wide">{t('Change in Account')}</Link>
        </div>
      </>
    )
  }

  const length = describeLength(title)
  const upcoming = upcomingRelease(title)
  const saved = myList.includes(title.id)
  const favorite = favorites.includes(title.id)
  // Lists, ratings and reviews point at `titles` rows: with Supabase, the tmdb function stores the title first
  const storeTitle = () => store(title)
  const keep = async (toggle, isOn) => {
    setSaveError(null)
    if (!isOn && !(await storeTitle())) {
      setSaveError(t('Couldn’t save this title. Please try again.'))
      return
    }
    toggle(title.id)
  }
  const moreLikeThis = (recommended ?? []).filter(isAllowed).filter(notDisliked(reactions))
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
        <p className="eyebrow">{title.type === 'show' ? t('SERIES') : t('FILM')} · TMDB</p>
        <h2 className="detail-title">{title.title.toUpperCase()}</h2>
        <p className="detail-meta">
          {title.year && <span>{title.year}</span>}
          <span className="maturity">{title.maturity}</span>
          {length && <span>{length}</span>}
          {title.rating != null && <span>{t('TMDB rating {rating}/10', { rating: title.rating })}</span>}
        </p>
        <p className="muted">{t('Not available to stream here (see where to watch below).')} <a href={title.tmdbUrl} className="inline-link" target="_blank" rel="noreferrer">{t('View {title} on TMDB', { title: title.title })}</a></p>

        <div className="detail-actions">
          {title.trailer && !watchingTrailer && (
            <button type="button" className="play wide" onClick={() => setWatchingTrailer(true)}><span aria-hidden="true">▶</span> {t('Play trailer')}</button>
          )}
          <div className="action-row">
            <button className={saved ? 'ghost-action on' : 'ghost-action'} aria-pressed={saved} onClick={() => keep(toggleMyList, saved)}>
              <Icon name={saved ? 'check' : 'plus'} /><span>{t('My List')}</span>
            </button>
            <button className={favorite ? 'ghost-action on' : 'ghost-action'} aria-pressed={favorite} onClick={() => keep(toggleFavorite, favorite)}>
              <Icon name="heart" filled={favorite} /><span>{t('Favorite')}</span>
            </button>
          </div>
          {upcoming && (
            <div className="release-reminder">
              <p className="muted">{upcoming.label}</p>
              <button className={reminder.isSet(title) ? 'ghost-action on' : 'ghost-action'} aria-pressed={reminder.isSet(title)}
                onClick={() => reminder.toggle(title, upcoming.day)}>
                <Icon name={reminder.isSet(title) ? 'check' : 'bell'} /><span>{reminder.isSet(title) ? t('Reminder set') : t('Remind Me')}</span>
              </button>
            </div>
          )}
          {(saveError || reminder.error) && <p className="form-alert" role="alert">{saveError || reminder.error}</p>}
        </div>

        <TitleReaction title={title} beforeSave={storeTitle} />
        <AddToList title={title} beforeAdd={storeTitle} />

        <p className="synopsis">{title.synopsis}</p>
        <Credits title={title} />
        {title.genres.length > 0 && <p className="credits"><span>{t('Genres')}:</span> {genreLabels(title, t).join(', ')}</p>}

        {title.seasonList?.length > 0 && <TmdbEpisodes key={title.id} title={title} />}
        <WhereToWatch title={title} />
        <Reviews title={title} beforeSave={storeTitle} />
        <TmdbCredit />
      </div>

      {moreLikeThis.length > 0 && (
        <Row title={t('More Like This')}>{moreLikeThis.map((t) => <PosterCard key={t.id} title={t} />)}</Row>
      )}
    </>
  )
}
