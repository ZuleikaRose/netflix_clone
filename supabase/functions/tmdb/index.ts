// POST /functions/v1/tmdb { action, … } → movies and TV shows from The Movie Database (TMDB), in the app's title shape
//   { action: 'lists' }                              → { newMovies, newShows, trendingMovies, trendingShows,
//                                                         popularMovies, popularShows }
//   { action: 'search', query }                      → { results }
//   { action: 'title', type: 'movie' | 'show', id }  → { title } with cast, crew, certification, length, trailer
//                                                         and where to watch it in the U.S.
//   { action: 'recommendations', type, id }          → { results }: titles TMDB recommends to fans of this one
//   { action: 'save', type, id } (signed in)         → { title } after storing it, so it can go on My List or Favorites
// Public like the catalog itself (except `save`); the TMDB key stays in the TMDB_API_FREE secret and never reaches
// the browser. List, search and recommendation results carry real US certifications (looked up once per title and
// kept in public.tmdb_certifications), so restricted profiles see the titles within their maturity setting.
import { admin, allowRequest, callerFrom, clientIp, json, serve } from '../_shared/supabase.ts'

const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p/'
const key = Deno.env.get('TMDB_API_FREE') ?? ''
// A v4 "API Read Access Token" is a JWT sent as a bearer token; a v3 "API Key" goes in the query string
const isReadToken = key.startsWith('eyJ')

// Per IP, counting only requests that reach TMDB: answers from the cache below are free, so browsing pages that
// show the same lists doesn't use it up; a script asking for new searches or titles does
const MAX_REQUESTS_PER_HOUR = 600
const LIST_TTL_MS = 15 * 60 * 1000
const SEARCH_TTL_MS = 5 * 60 * 1000
const MAX_CACHED = 500
const CAST_SIZE = 8
const CERTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // certifications rarely change
const CERTIFICATION_LOOKUPS_AT_ONCE = 8 // keeps a cold start well inside TMDB's request rate
const PROVIDER_LOGO_SIZE = 'w92'

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
const isCached = (cacheKey: string) => (cache.get(cacheKey)?.expires ?? 0) > Date.now()

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

// US certification (PG-13, TV-MA…) from a title's release_dates or content_ratings; 'NR' when TMDB has none
function certification(item: Item, type: Type) {
  if (type === 'show') return item.content_ratings?.results?.find((r: Item) => r.iso_3166_1 === 'US')?.rating || 'NR'
  const us = item.release_dates?.results?.find((r: Item) => r.iso_3166_1 === 'US')
  return us?.release_dates?.map((d: Item) => d.certification).find(Boolean) || 'NR'
}

const lookUpCertification = (type: Type, id: number) =>
  tmdb(`/${tmdbPath(type)}/${id}/${type === 'show' ? 'content_ratings' : 'release_dates'}`)
    .then((answer) => certification(type === 'show' ? { content_ratings: answer } : { release_dates: answer }, type))

// Runs `work` on every item, a few at a time
async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work))
}

// Fills in `maturity` for list and search results: from tmdb_certifications, else from TMDB (then stored there).
// Any failure leaves 'NR', which only restricted profiles notice (they don't see those titles).
async function withCertifications<T extends { tmdbId: number; type: Type; maturity: string }>(titles: T[]): Promise<T[]> {
  if (!titles.length) return titles
  const keyOf = (type: Type, id: number) => `${tmdbPath(type)}:${id}`
  const found = new Map<string, string>()
  const { data, error } = await admin.from('tmdb_certifications').select('media_type, tmdb_id, certification')
    .in('tmdb_id', [...new Set(titles.map((t) => t.tmdbId))])
    .gte('fetched_at', new Date(Date.now() - CERTIFICATION_TTL_MS).toISOString())
  if (error) console.error('tmdb_certifications:', error.message)
  for (const row of data ?? []) found.set(`${row.media_type}:${row.tmdb_id}`, row.certification)

  const missing = [...new Map(titles.filter((t) => !found.has(keyOf(t.type, t.tmdbId)))
    .map((t) => [keyOf(t.type, t.tmdbId), t])).values()]
  const looked: Item[] = []
  await inBatches(missing, CERTIFICATION_LOOKUPS_AT_ONCE, async (t) => {
    try {
      const value = await lookUpCertification(t.type, t.tmdbId)
      found.set(keyOf(t.type, t.tmdbId), value)
      looked.push({ media_type: tmdbPath(t.type), tmdb_id: t.tmdbId, certification: value, fetched_at: new Date().toISOString() })
    } catch (lookupError) {
      console.error('certification lookup:', lookupError instanceof Error ? lookupError.message : lookupError)
    }
  })
  if (looked.length) {
    const { error: saveError } = await admin.from('tmdb_certifications').upsert(looked)
    if (saveError) console.error('tmdb_certifications:', saveError.message)
  }
  return titles.map((t) => ({ ...t, maturity: found.get(keyOf(t.type, t.tmdbId)) ?? 'NR' }))
}

async function toTitles(items: Item[], type?: Type) {
  const [movieGenres, showGenres] = await Promise.all([genreNames('movie'), genreNames('show')])
  const titles = items
    .map((item) => ({ item, itemType: type ?? (item.media_type === 'tv' ? 'show' : 'movie') as Type }))
    .filter(({ item }) => item.poster_path || item.backdrop_path)
    .map(({ item, itemType }) => {
      const genres = itemType === 'show' ? showGenres : movieGenres
      return toTitle(item, itemType, (item.genre_ids ?? []).map((id: number) => genres.get(id)).filter(Boolean))
    })
  return withCertifications(titles)
}

const list = (path: string, type: Type) =>
  cached(`list:${path}`, LIST_TTL_MS, async () => toTitles((await tmdb(path)).results, type))

// New: movies in theaters now and TV shows with an episode airing this week
const lists = () => cached('lists', LIST_TTL_MS, async () => {
  const [newMovies, newShows, trendingMovies, trendingShows, popularMovies, popularShows] = await Promise.all([
    list('/movie/now_playing', 'movie'),
    list('/tv/on_the_air', 'show'),
    list('/trending/movie/week', 'movie'),
    list('/trending/tv/week', 'show'),
    list('/movie/popular', 'movie'),
    list('/tv/popular', 'show'),
  ])
  return { newMovies, newShows, trendingMovies, trendingShows, popularMovies, popularShows }
})

const search = (query: string) => cached(`search:${query.toLowerCase()}`, SEARCH_TTL_MS, async () => {
  const { results } = await tmdb('/search/multi', { query, include_adult: 'false' })
  return toTitles(results.filter((r: Item) => r.media_type === 'movie' || r.media_type === 'tv'))
})

const names = (people: Item[] = []) => [...new Set(people.map((p) => p.name))].join(', ') || null

// The official YouTube trailer when there is one, else any YouTube trailer or teaser
function trailer(item: Item) {
  const videos: Item[] = (item.videos?.results ?? [])
    .filter((v: Item) => v.site === 'YouTube' && /^[\w-]{6,20}$/.test(v.key ?? ''))
  const pick = videos.find((v) => v.type === 'Trailer' && v.official) ?? videos.find((v) => v.type === 'Trailer') ??
    videos.find((v) => v.type === 'Teaser')
  return pick ? { key: pick.key, name: pick.name } : null
}

// Where to watch in the U.S. (data from JustWatch, which TMDB's terms ask us to credit): services by kind, and the
// TMDB page that links to each one
function providers(item: Item) {
  const us = item['watch/providers']?.results?.US
  if (!us) return null
  const services = (list: Item[] = []) => list.map((p) => ({ name: p.provider_name, logo: image(p.logo_path, PROVIDER_LOGO_SIZE) }))
  const found = { link: us.link ?? null, stream: services(us.flatrate), rent: services(us.rent), buy: services(us.buy) }
  return found.stream.length || found.rent.length || found.buy.length ? found : null
}

const title = (type: Type, id: number) => cached(`title:${type}:${id}`, LIST_TTL_MS, async () => {
  const append = `credits,videos,watch/providers,${type === 'show' ? 'content_ratings' : 'release_dates'}`
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
    trailer: trailer(item),
    providers: providers(item),
  }
})

const recommendations = (type: Type, id: number) => cached(`recommendations:${type}:${id}`, LIST_TTL_MS, async () =>
  toTitles((await tmdb(`/${tmdbPath(type)}/${id}/recommendations`)).results, type))

// Stores a TMDB title a member saves: its core fields as a titles row (source 'tmdb', so watch lists and favorites
// can reference it) and its TMDB-only details in tmdb_titles. Built from TMDB's data, never from what the browser sends.
const save = (type: Type, id: number) => cached(`saved:${type}:${id}`, LIST_TTL_MS, async () => {
  const t = await title(type, id)
  const { error } = await admin.from('titles').upsert({
    id: t.id, title: t.title, type, release_year: t.year, maturity_rating: t.maturity,
    seasons: type === 'show' ? t.seasons : null, runtime: type === 'movie' ? t.runtime : null,
    genres: t.genres, synopsis: t.synopsis, cast_members: t.cast, director: t.crew.director, writer: t.crew.writer,
    popularity: t.popularity, image_url: t.image, source: 'tmdb',
  })
  if (error) throw error
  const { error: detailsError } = await admin.from('tmdb_titles').upsert({
    title_id: t.id, tmdb_id: id, media_type: tmdbPath(type), backdrop_url: t.backdrop, tmdb_rating: t.rating,
    tmdb_url: t.tmdbUrl, trailer_youtube_key: t.trailer?.key ?? null, fetched_at: new Date().toISOString(),
  })
  if (detailsError) throw detailsError
  return t
})

const asType = (value: unknown): Type | null => (value === 'movie' || value === 'show' ? value : null)

// The request as [cache key, answer], or an error response for a bad request
function route(body: Record<string, unknown>): [string, () => Promise<unknown>] | Response {
  switch (body.action) {
    case 'lists':
      return ['lists', lists]
    case 'search': {
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : ''
      if (!query) return json({ results: [] })
      return [`search:${query.toLowerCase()}`, async () => ({ results: await search(query) })]
    }
    case 'title':
    case 'recommendations':
    case 'save': {
      const type = asType(body.type)
      const id = Number(body.id)
      if (!type || !Number.isInteger(id) || id <= 0) return json({ error: 'Send a type (movie or show) and a TMDB id.' }, 400)
      if (body.action === 'save') return [`saved:${type}:${id}`, async () => ({ title: await save(type, id) })]
      if (body.action === 'recommendations') {
        return [`recommendations:${type}:${id}`, async () => ({ results: await recommendations(type, id) })]
      }
      return [`title:${type}:${id}`, async () => ({ title: await title(type, id) })]
    }
    default:
      return json({ error: 'Unknown action. Use lists, search, title, recommendations or save.' }, 400)
  }
}

serve(async (req, body) => {
  if (!key) return json({ error: 'TMDB is not configured.' }, 503)
  const request = route(body)
  if (request instanceof Response) return request
  // Only members save titles (they're for their lists), so a visitor can't fill the table
  if (body.action === 'save' && !(await callerFrom(req))) return json({ error: 'Please sign in again.' }, 401)
  const [cacheKey, answer] = request
  if (!isCached(cacheKey) && !(await allowRequest(`tmdb:${clientIp(req)}`, MAX_REQUESTS_PER_HOUR, 3600))) {
    return json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  try {
    return json(await answer())
  } catch (error) {
    if (error instanceof NotFound) return json({ error: 'Title not found.' }, 404)
    throw error
  }
})
