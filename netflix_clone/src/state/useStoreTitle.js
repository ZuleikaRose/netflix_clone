import { saveTmdbTitle } from '../data/tmdbApi.js'
import { authBackend } from '../lib/supabaseConfig.js'
import { useCatalog } from './useCatalog.js'

// storeTitle(title) → true once a title can go on a list or get a rating. Catalog titles always can; a TMDB title
// becomes a `titles` row first (with Supabase, through the tmdb function) and findable on this page load.
export function useStoreTitle() {
  const { rememberTitle } = useCatalog()
  return async (title) => {
    if (title.source !== 'tmdb') return true
    if (authBackend === 'supabase' && !(await saveTmdbTitle(title))) return false
    rememberTitle(title)
    return true
  }
}
