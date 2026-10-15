import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { genres } from '../data/catalog.js'
import { useCatalog } from '../state/useCatalog.js'

const sorters = {
  popular: (a, b) => b.popularity - a.popularity,
  newest: (a, b) => b.year - a.year,
  az: (a, b) => a.title.localeCompare(b.title),
}

export function Search() {
  // Query state lives in the URL so results survive Back/Forward and can be shared
  const [params, setParams] = useSearchParams()
  const { titles: catalog } = useCatalog()
  const q = params.get('q') ?? ''
  const genre = params.get('genre') ?? ''
  const type = params.get('type') ?? ''
  const sort = params.get('sort') ?? 'popular'

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const needle = q.trim().toLowerCase()
  const results = catalog
    .filter((t) => !needle || [t.title, ...t.cast, ...t.genres].some((s) => s.toLowerCase().includes(needle)))
    .filter((t) => !genre || t.genres.includes(genre))
    .filter((t) => !type || t.type === type)
    .sort(sorters[sort] ?? sorters.popular)

  return (
    <>
      <PageHeader title="Search" back />
      <div className="search-panel">
        <label htmlFor="search-input" className="sr-only">Search titles, people, genres</label>
        <input id="search-input" type="search" className="search-input" placeholder="Search titles, people, genres" value={q} onChange={(e) => update('q', e.target.value)} autoFocus />

        <div className="genre-chips" role="group" aria-label="Filter by genre">
          {genres.map((g) => (
            <button key={g} className={genre === g ? 'chip active' : 'chip'} aria-pressed={genre === g} onClick={() => update('genre', genre === g ? '' : g)}>{g}</button>
          ))}
        </div>

        <div className="search-selects">
          <label>Type
            <select value={type} onChange={(e) => update('type', e.target.value)}>
              <option value="">All</option>
              <option value="show">TV Shows</option>
              <option value="movie">Movies</option>
            </select>
          </label>
          <label>Sort by
            <select value={sort} onChange={(e) => update('sort', e.target.value)}>
              <option value="popular">Popularity</option>
              <option value="newest">Release date</option>
              <option value="az">A–Z</option>
            </select>
          </label>
        </div>
      </div>

      <h2 className="results-heading" aria-live="polite">{needle || genre || type ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Top Searches'}</h2>
      {results.length > 0
        ? <div className="poster-grid">{results.map((t) => <PosterCard key={t.id} title={t} />)}</div>
        : <p className="empty">No matches for “{q}”. Try a different title, actor or genre.</p>}
    </>
  )
}
