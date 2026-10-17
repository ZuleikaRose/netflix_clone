import { createContext, useContext } from 'react'

export const CatalogContext = createContext(null)

// { titles, source: 'local' | 'supabase', error } — every title, before the maturity filter in useCatalog
export function useCatalogSource() {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error('useCatalogSource must be used inside <CatalogProvider>')
  return catalog
}
