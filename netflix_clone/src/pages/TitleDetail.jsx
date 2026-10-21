import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AddToList } from '../components/AddToList.jsx'
import { CreditLinks } from '../components/CreditLinks.jsx'
import { Episodes } from '../components/Episodes.jsx'
import { Icon } from '../components/Icon.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { Player } from '../components/Player.jsx'
import { Preview } from '../components/Preview.jsx'
import { Reviews } from '../components/Reviews.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { Row } from '../components/Row.jsx'
import { ShareButton } from '../components/ShareButton.jsx'
import { useDocumentTitle } from '../components/useDocumentTitle.js'
import { describeLength } from '../data/catalog.js'
import { useCatalog } from '../state/useCatalog.js'
import { useLibrary } from '../state/libraryContext.js'
import { NotFound } from './NotFound.jsx'
import { episodeCode, findEpisode, seasonsFor } from '../data/episodes.js'
import { invitePath, startParty } from '../data/partyApi.js'
import { personPath, splitNames } from '../data/people.js'

// The show's seasons; the list opens on the season the viewer is in
function CatalogEpisodes({ title, progress, onPlay }) {
  const seasons = seasonsFor(title)
  const current = progress ? findEpisode(title, progress.episode) : null
  const [season, setSeason] = useState(current?.season ?? 1)
  const episodes = seasons.find((s) => s.season === season)?.episodes ?? []
  return (
    <Episodes
      title={title.title}
      seasons={seasons.map((s) => ({ number: s.season, label: `Season ${s.season}` }))}
      season={season}
      onSeason={setSeason}
      episodes={episodes.map((e) => ({
        key: e.number,
        number: e.number,
        code: episodeCode(e),
        name: e.name,
        meta: `${e.minutes}m${current?.number === e.number ? ' · Continue watching' : ''}`,
        percent: current?.number === e.number ? progress.percent : 0,
      }))}
      onPlay={(e) => onPlay(e.number)}
    />
  )
}

// Starts a watch party for this title and opens it
function PartyButton({ title }) {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const start = async () => {
    setError(null)
    try {
      navigate(invitePath(await startParty(title.id)))
    } catch {
      setError('The watch party couldn’t be started. Please try again.')
    }
  }
  return (
    <>
      <button type="button" className="ghost-action" onClick={start}><Icon name="party" /><span>Watch party</span></button>
      {error && <p className="form-alert" role="alert">{error}</p>}
    </>
  )
}

export function TitleDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { myList, favorites, progress, toggleMyList, toggleFavorite } = useLibrary()
  const { titles: catalog, isAllowed, findTitle } = useCatalog()

  const title = findTitle(id)
  // Runs after PageHeader's effect (parents run last), so the tab shows the show's name, not "TV Show"
  useDocumentTitle(title?.title)
  if (!title) return <NotFound />
  if (!isAllowed(title)) {
    return (
      <>
        <PageHeader title="Restricted" back />
        <div className="empty">
          <p>{title.title} is rated {title.maturity}, which is above this profile’s maturity setting.</p>
          <Link to="/account" className="play wide">Change in Account</Link>
        </div>
      </>
    )
  }

  const playing = params.get('play') === '1'
  const saved = myList.includes(id)
  const favorite = favorites.includes(id)
  const related = catalog.filter((t) => t.id !== id && t.genres.some((g) => title.genres.includes(g)))

  return (
    <>
      <PageHeader title={title.type === 'show' ? 'TV Show' : 'Movie'} back />

      {playing
        ? <Player key={params.get('episode')} title={title} startEpisode={Number(params.get('episode')) || null} onClose={() => setParams({}, { replace: true })} />
        : (
          <div className="detail-art">
            <Preview title={title} />
            <div className="hero-shade" />
          </div>
        )}

      <div className="detail-body">
        <p className="eyebrow"><b>N</b> {title.type === 'show' ? 'SERIES' : 'FILM'}</p>
        <h2 className="detail-title">{title.title.toUpperCase()}</h2>
        <p className="detail-meta">
          <span>{title.year}</span><span className="maturity">{title.maturity}</span><span>{describeLength(title)}</span>
        </p>

        <div className="detail-actions">
          <button className="play wide" onClick={() => setParams({ play: '1' }, { replace: true })}><span aria-hidden="true">▶</span> {progress[id] ? 'Resume' : 'Play'}</button>
          <div className="action-row">
            <button className={saved ? 'ghost-action on' : 'ghost-action'} aria-pressed={saved} onClick={() => toggleMyList(id)}>
              <Icon name={saved ? 'check' : 'plus'} /><span>My List</span>
            </button>
            <button className={favorite ? 'ghost-action on' : 'ghost-action'} aria-pressed={favorite} onClick={() => toggleFavorite(id)}>
              <Icon name="heart" filled={favorite} /><span>Favorite</span>
            </button>
            <ShareButton title={title} />
            <PartyButton title={title} />
          </div>
        </div>

        <AddToList title={title} />

        <p className="synopsis">{title.synopsis}</p>
        <CreditLinks label="Starring" people={title.cast.map((name) => ({ name, to: personPath(name) }))} />
        <CreditLinks label="Director" people={splitNames(title.crew.director).map((name) => ({ name, to: personPath(name) }))} />
        <CreditLinks label="Writer" people={splitNames(title.crew.writer).map((name) => ({ name, to: personPath(name) }))} />
        <p className="credits"><span>Genres:</span> {title.genres.join(', ')}</p>

        {title.type === 'show' && (
          <CatalogEpisodes title={title} progress={progress[id]} onPlay={(n) => setParams({ play: '1', episode: String(n) }, { replace: true })} />
        )}
        <Reviews title={title} />
      </div>

      {related.length > 0 && (
        <Row title="More Like This">{related.map((t) => <PosterCard key={t.id} title={t} />)}</Row>
      )}
    </>
  )
}
