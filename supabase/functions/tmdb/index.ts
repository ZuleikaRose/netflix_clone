// POST /functions/v1/tmdb { action, … } → movies and TV shows from The Movie Database (TMDB), in the app's title shape
//   { action: 'lists' }                              → { trendingMovies, trendingShows, popularMovies, popularShows }
//   { action: 'search', query }                      → { results }
//   { action: 'title', type: 'movie' | 'show', id }  → { title } with cast, crew, certification and length
// Public like the catalog itself; the TMDB key stays in the TMDB_API_FREE secret and never reaches the browser.
import { allowRequest, clientIp, json, serve } from '../_shared/supabase.ts'

const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p/'
const key = Deno.env.get('TMDB_API_FREE') ?? ''
// A v4 "API Read Access Token" is a JWT sent as a bearer token; a v3 "API Key" goes in the query string
const isReadToken = key.startsWith('eyJ')

// Per IP: generous for browsing (every page load asks for the lists once), low enough to protect the TMDB quota
const MAX_REQUESTS_PER_HOUR = 600
const LIST_TTL_MS = 15 * 60 * 1000
const SEARCH_TTL_MS = 5 * 60 * 1000
const MAX_CACHED = 500
const CAST_SIZE = 8

type Type = 'movie' | 'show'
type Item = Record<string, any>

// Responses kept for a few minutes per function instance, so busy pages don't each cost TMDB requests
const cache = new Map<string, { expires: number; value: Promise<unknown> }>()
function cached<T>(cacheKey: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>
  if (cache.size >= MAX_CACHED) cache.clear()
  const value = load()
  cache.set(cacheKey, { expires: Date.now() + ttl, value })
  value.catch(() => cache.delete(cacheKey))
  return value
}

class NotFound extends Error {}

async function tmdb(path: string, params: Record<string, string> = {}): Promise<Item> {
  const url = new URL(API + path)
  for (const [name, value] of Object.entries({ language: 'en-US', ...params })) url.searchParams.set(name, value)
  if (!isReadToken) url.searchParams.set('api_key', key)
  const response = await fetch(url, {
    headers: { accept: 'application/json', ...(isReadToken ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 404) throw new NotFound()
  if (!response.ok) throw new Error(`TMDB ${path}: ${response.status} ${await response.text()}`)
  return response.json()
}

const tmdbPath = (type: Type) => (type === 'show' ? 'tv' : 'movie')

// TMDB list results carry genre ids only; the names come from TMDB's genre lists
const genreNames = (type: Type) => cached(`genres:${type}`, LIST_TTL_MS, async () => {
  const { genres } = await tmdb(`/genre/${tmdbPath(type)}/list`)
  return new Map<number, string>(genres.map((g: Item) => [g.id, g.name]))
})

const image = (path: string | null, size: string) => (path ? `${IMAGES}${size}${path}` : null)

const formatRuntime = (minutes?: number) =>
  minutes ? [Math.floor(minutes / 60) && `${Math.floor(minutes / 60)}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ') : null

// The shape of data/catalog.js titles, plus `source`, `tmdbId`, `rating`, `backdrop` and `tmdbUrl`.
// List and search results have no certification, so `maturity` is 'NR' until the title is opened.
function toTitle(item: Item, type: Type, genres: string[]) {
  return {
    id: `tmdb-${type}-${item.id}`,
    tmdbId: item.id,
    source: 'tmdb',
    title: item.title ?? item.name,
    type,
    year: Number((item.release_date ?? item.first_air_date ?? '').slice(0, 4)) || null,
    maturity: 'NR',
    genres,
    mood: [],
    popularity: Math.round((item.vote_average ?? 0) * 10),
    rating: item.vote_count ? Math.round(item.vote_average * 10) / 10 : null,
    isNew: false,
    top10: null,
    image: image(item.poster_path, 'w342') ?? image(item.backdrop_path, 'w780'),
    backdrop: image(item.backdrop_path, 'w780') ?? image(item.poster_path, 'w500'),
    tint: 'none',
    synopsis: item.overview || 'No overview yet.',
    cast: [],
    crew: { director: null, writer: null },
    reviews: [],
    tmdbUrl: `https://www.themoviedb.org/${tmdbPath(type)}/${item.id}`,
  }
}

async function toTitles(items: Item[], type?: Type) {
  const [movieGenres, showGenres] = await Promise.all([genreNames('movie'), genreNames('show')])
  return items
    .map((item) => ({ item, itemType: type ?? (item.media_type === 'tv' ? 'show' : 'movie') as Type }))
    .filter(({ item }) => item.poster_path || item.backdrop_path)
    .map(({ item, itemType }) => {
      const genres = itemType === 'show' ? showGenres : movieGenres
      return toTitle(item, itemType, (item.genre_ids ?? []).map((id: number) => genres.get(id)).filter(Boolean))
    })
}

const list = (path: string, type: Type) =>
  cached(`list:${path}`, LIST_TTL_MS, async () => toTitles((await tmdb(path)).results, type))

const lists = async () => {
  const [trendingMovies, trendingShows, popularMovies, popularShows] = await Promise.all([
    list('/trending/movie/week', 'movie'),
    list('/trending/tv/week', 'show'),
    list('/movie/popular', 'movie'),
    list('/tv/popular', 'show'),
  ])
  return { trendingMovies, trendingShows, popularMovies, popularShows }
}

const search = (query: string) => cached(`search:${query.toLowerCase()}`, SEARCH_TTL_MS, async () => {
  const { results } = await tmdb('/search/multi', { query, include_adult: 'false' })
  return toTitles(results.filter((r: Item) => r.media_type === 'movie' || r.media_type === 'tv'))
})

// US certification (PG-13, TV-MA…); 'NR' when TMDB has none
function certification(item: Item, type: Type) {
  if (type === 'show') return item.content_ratings?.results?.find((r: Item) => r.iso_3166_1 === 'US')?.rating || 'NR'
  const us = item.release_dates?.results?.find((r: Item) => r.iso_3166_1 === 'US')
  return us?.release_dates?.map((d: Item) => d.certification).find(Boolean) || 'NR'
}

const names = (people: Item[] = []) => [...new Set(people.map((p) => p.name))].join(', ') || null

const title = (type: Type, id: number) => cached(`title:${type}:${id}`, LIST_TTL_MS, async () => {
  const append = type === 'show' ? 'credits,content_ratings' : 'credits,release_dates'
  const item = await tmdb(`/${tmdbPath(type)}/${id}`, { append_to_response: append })
  const crew: Item[] = item.credits?.crew ?? []
  return {
    ...toTitle(item, type, (item.genres ?? []).map((g: Item) => g.name)),
    maturity: certification(item, type),
    ...(type === 'show' ? { seasons: item.number_of_seasons ?? 1 } : { runtime: formatRuntime(item.runtime) }),
    cast: (item.credits?.cast ?? []).slice(0, CAST_SIZE).map((p: Item) => p.name),
    crew: {
      director: type === 'show' ? names(item.created_by) : names(crew.filter((p) => p.job === 'Director')),
      writer: names(crew.filter((p) => ['Screenplay', 'Writer', 'Story'].includes(p.job)).slice(0, 3)),
    },
  }
})

const asType = (value: unknown): Type | null => (value === 'movie' || value === 'show' ? value : null)

serve(async (req, body) => {
  if (!key) return json({ error: 'TMDB is not configured.' }, 503)
  if (!(await allowRequest(`tmdb:${clientIp(req)}`, MAX_REQUESTS_PER_HOUR, 3600))) {
    return json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  try {
    switch (body.action) {
      case 'lists':
        return json(await lists())
      case 'search': {
        const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : ''
        return json({ results: query ? await search(query) : [] })
      }
      case 'title': {
        const type = asType(body.type)
        const id = Number(body.id)
        if (!type || !Number.isInteger(id) || id <= 0) return json({ error: 'Send a type (movie or show) and a TMDB id.' }, 400)
        return json({ title: await title(type, id) })
      }
      default:
        return json({ error: 'Unknown action. Use lists, search or title.' }, 400)
    }
  } catch (error) {
    if (error instanceof NotFound) return json({ error: 'Title not found.' }, 404)
    throw error
  }
})
