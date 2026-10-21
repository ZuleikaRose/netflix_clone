import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { TmdbCredit } from '../components/TmdbCredit.jsx'
import { useCatalog } from '../state/useCatalog.js'
import { useTmdbLists, useTmdbSearch } from '../state/useTmdb.js'

// Release-date filter (outline: filter by genre, release date or popularity)
const releaseYears = [2026, 2025, 2024]
const EARLIEST_LISTED_YEAR = releaseYears.at(-1)

const sorters = {
  popular: (a, b) => b.popularity - a.popularity,
  newest: (a, b) => (b.year ?? 0) - (a.year ?? 0),
  az: (a, b) => a.title.localeCompare(b.title),
}

// The genre chips come from the catalog; TMDB names some genres differently ("Science Fiction", "Sci-Fi & Fantasy",
// "Action & Adventure"), so a chip also matches either half of a combined TMDB genre and the long Sci-Fi name
const genreAliases = { 'Sci-Fi': ['Science Fiction', 'Sci-Fi & Fantasy'] }
const hasGenre = (title, genre) => title.genres.some((g) => g === genre || g.split(' & ').includes(genre)
  || genreAliases[genre]?.includes(g))

// Without a query, Search browses every movie and TV show in TMDB's lists (new, trending and popular), once each
// Every TMDB list title once, except films not out yet (those are New & Hot's Coming Soon)
const allListed = (lists) => [...new Map(Object.entries(lists).filter(([name]) => name !== 'upcomingMovies')
  .flatMap(([, titles]) => titles).map((t) => [t.id, t])).values()]

export function Search() {
  // Query state lives in the URL so results survive Back/Forward and can be shared
  const [params, setParams] = useSearchParams()
  const { titles: catalog, genres, isAllowed } = useCatalog()
  const q = params.get('q') ?? ''
  const genre = params.get('genre') ?? ''
  const type = params.get('type') ?? ''
  const year = params.get('year') ?? ''
  const sort = params.get('sort') ?? 'popular'

  const setQueryParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const needle = q.trim().toLowerCase()
  // The same genre, type, year and sort apply to both lists; TMDB already matched the query itself
  const refine = (titles) => titles
    .filter((t) => !genre || hasGenre(t, genre))
    .filter((t) => !type || t.type === type)
    .filter((t) => !year || (year === 'earlier' ? t.year != null && t.year < EARLIEST_LISTED_YEAR : t.year === Number(year)))
    .sort(sorters[sort] ?? sorters.popular)
  const results = refine(catalog.filter((t) => !needle || [t.title, ...t.cast, ...t.genres].some((s) => s.toLowerCase().includes(needle))))
  const tmdb = useTmdbSearch(q)
  const tmdbLists = useTmdbLists()
  const tmdbFound = needle ? tmdb.results : tmdbLists && allListed(tmdbLists)
  // TMDB list and search items have no certification ('NR'), so restricted profiles don't see them
  const tmdbResults = tmdbFound ? refine(tmdbFound.filter(isAllowed)) : []
  const tmdbSearching = Boolean(needle) && tmdb.searching

  return (
    <>
      <PageHeader title="Search" back />
      <div className="search-panel">
        <label htmlFor="search-input" className="sr-only">Search titles, people, genres</label>
        <input id="search-input" type="search" className="search-input" placeholder="Search titles, people, genres" value={q} onChange={(e) => setQueryParam('q', e.target.value)} autoFocus />

        <div className="genre-chips" role="group" aria-label="Filter by genre">
          {genres.map((g) => (
            <button key={g} className={genre === g ? 'chip active' : 'chip'} aria-pressed={genre === g} onClick={() => setQueryParam('genre', genre === g ? '' : g)}>{g}</button>
          ))}
        </div>

        <div className="search-selects">
          <label>Type
            <select value={type} onChange={(e) => setQueryParam('type', e.target.value)}>
              <option value="">All</option>
              <option value="show">TV Shows</option>
              <option value="movie">Movies</option>
            </select>
          </label>
          <label>Released
            <select value={year} onChange={(e) => setQueryParam('year', e.target.value)}>
              <option value="">Any year</option>
              {releaseYears.map((y) => <option key={y} value={y}>{y}</option>)}
              <option value="earlier">Before {EARLIEST_LISTED_YEAR}</option>
            </select>
          </label>
          <label>Sort by
            <select value={sort} onChange={(e) => setQueryParam('sort', e.target.value)}>
              <option value="popular">Popularity</option>
              <option value="newest">Release date</option>
              <option value="az">A–Z</option>
            </select>
          </label>
        </div>
      </div>

      <h2 className="results-heading" aria-live="polite">{needle || genre || type || year ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Top Searches'}</h2>
      {results.length > 0
        ? <div className="poster-grid">{results.map((t) => <PosterCard key={t.id} title={t} />)}</div>
        : <p className="empty">{needle ? `No matches for “${q}”` : 'Nothing in our catalog matches these filters'}. Try a different title, actor or genre.</p>}

      {(tmdbSearching || tmdbResults.length > 0) && (
        <section aria-labelledby="tmdb-results-heading" aria-busy={tmdbSearching}>
          <h2 id="tmdb-results-heading" className="results-heading">
            {tmdbSearching ? 'Searching TMDB…' : `${tmdbResults.length} ${needle ? 'more' : `title${tmdbResults.length === 1 ? '' : 's'}`} on TMDB`}
          </h2>
          {tmdbResults.length > 0 && (
            <>
              <div className="poster-grid">{tmdbResults.map((t) => <PosterCard key={t.id} title={t} />)}</div>
              <TmdbCredit />
            </>
          )}
        </section>
      )}
    </>
  )
}
