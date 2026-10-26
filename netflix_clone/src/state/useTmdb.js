import { useEffect, useState } from 'react'
import { fetchTmdbLists, fetchTmdbPerson, fetchTmdbRecommendations, fetchTmdbSeason, fetchTmdbTitle, searchTmdb } from '../data/tmdbApi.js'
import { supabaseConfig } from '../lib/supabaseConfig.js'
import { useAccessibility } from './accessibilityContext.js'

// The interface language: Spanish asks TMDB for its Spanish titles and overviews, and switching asks again
const useLanguage = () => useAccessibility().settings.language

// Waits for typing to pause before asking TMDB
const SEARCH_DELAY_MS = 400

// TMDB's trending and popular lists, or null until they arrive (and when TMDB isn't available)
export function useTmdbLists() {
  const language = useLanguage()
  const [found, setFound] = useState({ language: null, lists: null })
  useEffect(() => {
    let ignore = false
    fetchTmdbLists(language).then((lists) => { if (!ignore) setFound({ language, lists }) })
    return () => { ignore = true }
  }, [language])
  // The other language's lists until the new ones arrive, so rows don't empty out on a switch
  return found.lists
}

// { results, searching }: results are null with no query, while waiting, or when TMDB isn't available
// (without Supabase there's no `tmdb` function to ask, so it never reports searching)
export function useTmdbSearch(query) {
  const q = supabaseConfig ? query.trim() : ''
  const language = useLanguage()
  const [found, setFound] = useState({ query: '', language: null, results: null })
  useEffect(() => {
    if (!q) return undefined
    let ignore = false
    const timer = setTimeout(() => {
      searchTmdb(q, language).then((results) => { if (!ignore) setFound({ query: q, language, results }) })
    }, SEARCH_DELAY_MS)
    return () => { ignore = true; clearTimeout(timer) }
  }, [q, language])
  const current = Boolean(q) && found.query === q && found.language === language
  return { results: current ? found.results : null, searching: Boolean(q) && !current }
}

// { status: 'loading' | 'ready' | 'missing' | 'unavailable', title }; asks nothing without a type
export function useTmdbTitle(type, id) {
  const language = useLanguage()
  const key = `${type}:${id}:${language}`
  const [found, setFound] = useState({ key: null })
  useEffect(() => {
    if (!type) return undefined
    let ignore = false
    fetchTmdbTitle(type, id, language).then((result) => { if (!ignore) setFound({ key, ...result }) })
    return () => { ignore = true }
  }, [key, type, id, language])
  if (found.key !== key) return { status: 'loading', title: null }
  if (found.unavailable) return { status: 'unavailable', title: null }
  return found.title ? { status: 'ready', title: found.title } : { status: 'missing', title: null }
}

// Titles TMDB recommends for a TMDB title, or null (no title, still loading, or TMDB isn't available)
export function useTmdbRecommendations(type, id) {
  const language = useLanguage()
  const key = `${type}:${id}:${language}`
  const [found, setFound] = useState({ key: null, results: null })
  useEffect(() => {
    if (!type || !id) return undefined
    let ignore = false
    fetchTmdbRecommendations(type, id, language).then((results) => { if (!ignore) setFound({ key, results }) })
    return () => { ignore = true }
  }, [key, type, id, language])
  return found.key === key ? found.results : null
}

// { status: 'loading' | 'ready' | 'missing' | 'unavailable', person }; asks nothing without an id
export function useTmdbPerson(id) {
  const language = useLanguage()
  const key = `${id}:${language}`
  const [found, setFound] = useState({ key: null })
  useEffect(() => {
    if (!id) return undefined
    let ignore = false
    fetchTmdbPerson(id, language).then((result) => { if (!ignore) setFound({ key, ...result }) })
    return () => { ignore = true }
  }, [key, id, language])
  if (found.key !== key) return { status: 'loading', person: null }
  if (found.unavailable) return { status: 'unavailable', person: null }
  return found.person ? { status: 'ready', person: found.person } : { status: 'missing', person: null }
}

// { status: 'loading' | 'ready' | 'missing' | 'unavailable', season } for one season of a TMDB show
export function useTmdbSeason(id, number) {
  const language = useLanguage()
  const key = `${id}:${number}:${language}`
  const [found, setFound] = useState({ key: null })
  useEffect(() => {
    if (!id || !number) return undefined
    let ignore = false
    fetchTmdbSeason(id, number, language).then((result) => { if (!ignore) setFound({ key, ...result }) })
    return () => { ignore = true }
  }, [key, id, number, language])
  if (found.key !== key) return { status: 'loading', season: null }
  if (found.unavailable) return { status: 'unavailable', season: null }
  return found.season ? { status: 'ready', season: found.season } : { status: 'missing', season: null }
}
