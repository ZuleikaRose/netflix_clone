import { useEffect, useState } from 'react'
import { catalog as localCatalog } from '../data/catalog.js'
import { fetchCatalog } from '../data/catalogApi.js'
import { CatalogContext } from './catalogContext.js'

// Renders the built-in catalog straight away, then swaps in the titles from Supabase's REST API once they arrive.
// If the request fails (offline, project paused…) the built-in catalog stays, so the app keeps working.
export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({ titles: localCatalog, source: 'local', error: null })

  useEffect(() => {
    let ignore = false
    fetchCatalog()
      .then((titles) => {
        if (!ignore && titles?.length) setCatalog({ titles, source: 'supabase', error: null })
      })
      .catch((error) => {
        if (ignore) return
        if (import.meta.env.DEV) console.warn('Catalog: using the built-in titles, Supabase request failed', error)
        setCatalog((c) => ({ ...c, error }))
      })
    return () => { ignore = true }
  }, [])

  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}
