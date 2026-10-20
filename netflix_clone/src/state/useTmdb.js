import { useEffect, useState } from 'react'
import { fetchTmdbLists, fetchTmdbTitle, searchTmdb } from '../data/tmdbApi.js'
import { supabaseConfig } from '../lib/supabaseConfig.js'

// Waits for typing to pause before asking TMDB
const SEARCH_DELAY_MS = 400

// TMDB's trending and popular lists, or null until they arrive (and when TMDB isn't available)
export function useTmdbLists() {
  const [lists, setLists] = useState(null)
  useEffect(() => {
    let ignore = false
    fetchTmdbLists().then((found) => { if (!ignore) setLists(found) })
    return () => { ignore = true }
  }, [])
  return lists
}

// { results, searching }: results are null with no query, while waiting, or when TMDB isn't available
// (without Supabase there's no `tmdb` function to ask, so it never reports searching)
export function useTmdbSearch(query) {
  const q = supabaseConfig ? query.trim() : ''
  const [found, setFound] = useState({ query: '', results: null })
  useEffect(() => {
    if (!q) return undefined
    let ignore = false
    const timer = setTimeout(() => {
      searchTmdb(q).then((results) => { if (!ignore) setFound({ query: q, results }) })
    }, SEARCH_DELAY_MS)
    return () => { ignore = true; clearTimeout(timer) }
  }, [q])
  const current = Boolean(q) && found.query === q
  return { results: current ? found.results : null, searching: Boolean(q) && !current }
}

// { status: 'loading' | 'ready' | 'missing' | 'unavailable', title }; asks nothing without a type
export function useTmdbTitle(type, id) {
  const key = `${type}:${id}`
  const [found, setFound] = useState({ key: null })
  useEffect(() => {
    if (!type) return undefined
    let ignore = false
    fetchTmdbTitle(type, id).then((result) => { if (!ignore) setFound({ key, ...result }) })
    return () => { ignore = true }
  }, [key, type, id])
  if (found.key !== key) return { status: 'loading', title: null }
  if (found.unavailable) return { status: 'unavailable', title: null }
  return found.title ? { status: 'ready', title: found.title } : { status: 'missing', title: null }
}
