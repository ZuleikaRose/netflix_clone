import { useEffect, useMemo, useState } from 'react'
import { fuzzyTitles } from '../data/fuzzy.js'
import { getSupabase, supabaseConfig } from '../lib/supabaseConfig.js'

const ASK_DELAY_MS = 250

// Catalog titles spelled close to the query (for "No exact matches"), best first: an array of titles, or null while
// asking. With Supabase the database ranks them (search_titles, pg_trgm); otherwise the same comparison runs here.
// titles: the titles the profile may see.
export function useSimilarTitles(query, titles, enabled) {
  const q = enabled ? query.trim() : ''
  const local = useMemo(() => (q && !supabaseConfig ? fuzzyTitles(titles, q).map((m) => m.title) : null), [q, titles])
  const [asked, setAsked] = useState({ q: null, ids: null })

  useEffect(() => {
    if (!q || !supabaseConfig) return undefined
    let ignore = false
    const timer = setTimeout(() => {
      getSupabase()
        .then((supabase) => supabase.rpc('search_titles', { p_query: q }))
        .then(({ data, error }) => {
          if (error) throw error
          if (!ignore) setAsked({ q, ids: data.map((r) => r.id) })
        })
        // The database can't be reached: compare here instead
        .catch(() => { if (!ignore) setAsked({ q, ids: fuzzyTitles(titles, q).map((m) => m.title.id) }) })
    }, ASK_DELAY_MS)
    return () => { ignore = true; clearTimeout(timer) }
  }, [q, titles])

  if (!q) return []
  if (local) return local
  if (asked.q !== q) return null
  return asked.ids.map((id) => titles.find((t) => t.id === id)).filter(Boolean)
}
