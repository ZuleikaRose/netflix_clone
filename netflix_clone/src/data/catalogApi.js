import { getSupabase } from '../lib/supabaseConfig.js'
import { catalog as localCatalog } from './catalog.js'

const columns = 'id, title, type, release_year, maturity_rating, seasons, runtime, genres, mood, synopsis, cast_members, '
  + 'director, writer, popularity, is_new, top10_rank, image_url, tint'

const localIndex = new Map(localCatalog.map((t, i) => [t.id, i]))

// A `titles` row in the shape the pages use. Sample reviews and watch progress aren't in the database yet,
// so they still come from the built-in catalog.
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
    progress: local?.progress,
  }
}

// Keeps the built-in order (the featured carousel and rows depend on it); titles only in the database go last
const byCatalogOrder = (a, b) => (localIndex.get(a.id) ?? Infinity) - (localIndex.get(b.id) ?? Infinity) || b.popularity - a.popularity

// GET /rest/v1/titles with the publishable key. Returns null when Supabase isn't configured.
export async function fetchCatalog() {
  const supabase = await getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('titles').select(columns)
  if (error) throw error
  return data.map(toTitle).sort(byCatalogOrder)
}
