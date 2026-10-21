import { useCallback, useEffect, useState } from 'react'
import { catalog as localCatalog } from '../data/catalog.js'
import { fetchCatalog } from '../data/catalogApi.js'
import { CatalogContext } from './catalogContext.js'

const mergeSaved = (list, more) => [...list, ...more.filter((t) => !list.some((s) => s.id === t.id))]

// Renders the built-in catalog straight away, then swaps in the titles from Supabase's REST API once they arrive.
// If the request fails (offline, project paused…) the built-in catalog stays, so the app keeps working.
// `saved` holds TMDB titles members have saved to lists (from the database, plus any saved on this page load), so
// My List and Favorites can show them; the catalog's own pages never list them.
export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({ titles: localCatalog, saved: [], source: 'local', error: null })

  useEffect(() => {
    let ignore = false
    fetchCatalog()
      .then((found) => {
        if (!ignore && found?.titles.length) {
          setCatalog((c) => ({ ...c, titles: found.titles, saved: mergeSaved(found.saved, c.saved), source: 'supabase', error: null }))
        }
      })
      .catch((error) => {
        if (ignore) return
        if (import.meta.env.DEV) console.warn('Catalog: using the built-in titles, Supabase request failed', error)
        setCatalog((c) => ({ ...c, error }))
      })
    return () => { ignore = true }
  }, [])

  const rememberTitle = useCallback((title) => setCatalog((c) => ({ ...c, saved: mergeSaved(c.saved, [title]) })), [])

  return <CatalogContext.Provider value={{ ...catalog, rememberTitle }}>{children}</CatalogContext.Provider>
}
