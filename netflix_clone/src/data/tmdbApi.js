import { getSupabase } from '../lib/supabaseConfig.js'
import { callFunction } from './accountApi.js'

// TMDB titles open on their own route (/tmdb/:type/:tmdbId), not the catalog's /title/:id
const withPath = (title) => ({ ...title, path: `/tmdb/${title.type}/${title.tmdbId}` })

// One request per question per page load. Resolves to the `tmdb` Edge Function's data, { error } when it fails (failed
// requests are forgotten, so the next visit tries again) or null without Supabase; TMDB sections then simply don't show.
const requests = new Map()
function askTmdb(body) {
  const key = JSON.stringify(body)
  if (!requests.has(key)) {
    requests.set(key, getSupabase().then(async (supabase) => {
      if (!supabase) return null
      const { data, error } = await callFunction(supabase, 'tmdb', body)
      if (!error) return data
      requests.delete(key)
      if (import.meta.env.DEV) console.warn('TMDB:', error)
      return { error }
    }).catch((error) => {
      // The supabase-js chunk failed to load (offline, new deploy): same as any other failure
      requests.delete(key)
      if (import.meta.env.DEV) console.warn('TMDB:', error)
      return { error: 'unavailable' }
    }))
  }
  return requests.get(key)
}

// { trendingMovies, trendingShows, popularMovies, popularShows } or null
export async function fetchTmdbLists() {
  const data = await askTmdb({ action: 'lists' })
  if (!data || data.error) return null
  return Object.fromEntries(Object.entries(data).map(([name, titles]) => [name, titles.map(withPath)]))
}

// Movies and TV shows matching the query, or null when TMDB can't be reached
export async function searchTmdb(query) {
  const data = await askTmdb({ action: 'search', query })
  return data?.results ? data.results.map(withPath) : null
}

// Titles TMDB recommends to fans of this one, or null when TMDB can't be reached
export async function fetchTmdbRecommendations(type, id) {
  const data = await askTmdb({ action: 'recommendations', type, id: Number(id) })
  return data?.results ? data.results.map(withPath) : null
}

// Stores a TMDB title in the database (signed-in members only) so My List and Favorites can point to it.
// Resolves to true once it's stored, false otherwise.
export async function saveTmdbTitle(title) {
  const data = await askTmdb({ action: 'save', type: title.type, id: title.tmdbId })
  return Boolean(data?.title)
}

// { title } (null when TMDB has no such title), or { unavailable: true }
export async function fetchTmdbTitle(type, id) {
  const data = await askTmdb({ action: 'title', type, id: Number(id) })
  if (data?.title) return { title: withPath(data.title) }
  return data?.error === 'Title not found.' ? { title: null } : { unavailable: true }
}
