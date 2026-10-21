import { getSupabase } from '../lib/supabaseConfig.js'
import { catalog as localCatalog } from './catalog.js'

const columns = 'id, title, type, release_year, maturity_rating, seasons, runtime, genres, mood, synopsis, cast_members, '
  + 'director, writer, popularity, is_new, top10_rank, image_url, tint, source'

const localIndex = new Map(localCatalog.map((t, i) => [t.id, i]))

// A `titles` row in the shape the pages use. Sample reviews aren't in the database, so they still come from the
// built-in catalog; watch progress is each member's own (LibraryProvider, watch_progress).
function toTitle(row) {
  const local = localCatalog[localIndex.get(row.id)]
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    year: row.release_year,
    maturity: row.maturity_rating,
    ...(row.type === 'show' ? { seasons: row.seasons } : { runtime: row.runtime }),
    genres: row.genres,
    mood: row.mood,
    popularity: row.popularity,
    isNew: row.is_new,
    top10: row.top10_rank,
    image: row.image_url,
    tint: row.tint,
    synopsis: row.synopsis,
    cast: row.cast_members,
    crew: { director: row.director, writer: row.writer },
    reviews: local?.reviews ?? [],
    // A TMDB title a member saved (id 'tmdb-<type>-<TMDB id>') opens on its TMDB page
    ...(row.source === 'tmdb' ? { source: 'tmdb', tmdbId: Number(row.id.split('-').pop()), path: `/tmdb/${row.type}/${row.id.split('-').pop()}` } : {}),
  }
}

// Keeps the built-in order (the featured carousel and rows depend on it); titles only in the database go last
const byCatalogOrder = (a, b) => (localIndex.get(a.id) ?? Infinity) - (localIndex.get(b.id) ?? Infinity) || b.popularity - a.popularity

// GET /rest/v1/titles with the publishable key: { titles, saved } — the catalog, and the TMDB titles members have
// saved to their lists (source 'tmdb'). Returns null when Supabase isn't configured.
export async function fetchCatalog() {
  const supabase = await getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('titles').select(columns)
  if (error) throw error
  const rows = data.map(toTitle)
  return {
    titles: rows.filter((t) => t.source !== 'tmdb').sort(byCatalogOrder),
    saved: rows.filter((t) => t.source === 'tmdb'),
  }
}
