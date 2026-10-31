import { getSupabase } from '../lib/supabaseConfig.js'
import { callFunction } from './accountApi.js'

// TMDB titles open on their own route (/tmdb/:type/:tmdbId), not the catalog's /title/:id
const withPath = (title) => ({ ...title, path: `/tmdb/${title.type}/${title.tmdbId}` })

// One request per question (and interface language) per page load. `language` 'es' asks for TMDB's Spanish
// titles and overviews; English sends no language, as before. Resolves to the `tmdb` Edge Function's data, { error } when it fails (failed
// requests are forgotten, so the next visit tries again) or null without Supabase; TMDB sections then simply don't show.
const requests = new Map()
function askTmdb(question, language) {
  const body = language === 'es' ? { ...question, language } : question
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
export async function fetchTmdbLists(language) {
  const data = await askTmdb({ action: 'lists' }, language)
  if (!data || data.error) return null
  return Object.fromEntries(Object.entries(data).map(([name, titles]) => [name, titles.map(withPath)]))
}

// The genre names to show: TMDB's Spanish ones when the function sent them (Spanish answers), else the English
// `genres` through the app's dictionary (English answers, and TMDB titles saved in the database)
export const genreLabels = (title, translate) => title.genreLabels ?? title.genres.map((g) => translate(g))

// Every title in TMDB's lists, once each, without Coming Soon (not out yet): Search's list with no query, Surprise me
export const listedTitles = (lists) => [...new Map(Object.entries(lists).filter(([name]) => name !== 'upcomingMovies')
  .flatMap(([, titles]) => titles).map((t) => [t.id, t])).values()]

// Movies and TV shows matching the query, or null when TMDB can't be reached
export async function searchTmdb(query, language) {
  const data = await askTmdb({ action: 'search', query }, language)
  return data?.results ? data.results.map(withPath) : null
}

// Titles TMDB recommends to fans of this one, or null when TMDB can't be reached
export async function fetchTmdbRecommendations(type, id, language) {
  const data = await askTmdb({ action: 'recommendations', type, id: Number(id) }, language)
  return data?.results ? data.results.map(withPath) : null
}

// Stores a TMDB title in the database (signed-in members only) so My List and Favorites can point to it. Always in
// English: the stored row is shared by every member.
// Resolves to true once it's stored, false otherwise.
export async function saveTmdbTitle(title) {
  const data = await askTmdb({ action: 'save', type: title.type, id: title.tmdbId })
  return Boolean(data?.title)
}

// { title } (null when TMDB has no such title), or { unavailable: true }
export async function fetchTmdbTitle(type, id, language) {
  const data = await askTmdb({ action: 'title', type, id: Number(id) }, language)
  if (data?.title) return { title: withPath(data.title) }
  return data?.error === 'Title not found.' ? { title: null } : { unavailable: true }
}

// { person } with their best-known titles (null when TMDB has no such person), or { unavailable: true }
export async function fetchTmdbPerson(id, language) {
  const data = await askTmdb({ action: 'person', id: Number(id) }, language)
  if (data?.person) return { person: { ...data.person, credits: data.person.credits.map(withPath) } }
  return data?.error === 'Person not found.' ? { person: null } : { unavailable: true }
}

// { season } with its episodes (null when TMDB has no such season), or { unavailable: true }
export async function fetchTmdbSeason(id, season, language) {
  const data = await askTmdb({ action: 'season', id: Number(id), season: Number(season) }, language)
  if (data?.season) return { season: data.season }
  return data?.error === 'Season not found.' ? { season: null } : { unavailable: true }
}
