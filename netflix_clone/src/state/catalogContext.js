import { createContext, useContext } from 'react'

export const CatalogContext = createContext(null)

// { titles, saved, source: 'local' | 'supabase', error, rememberTitle } — every catalog title (before the maturity
// filter in useCatalog), and the TMDB titles saved to members' lists
export function useCatalogSource() {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error('useCatalogSource must be used inside <CatalogProvider>')
  return catalog
}
