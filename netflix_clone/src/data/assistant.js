import { authBackend, getSupabase } from '../lib/supabaseConfig.js'
import { callFunction } from './accountApi.js'

// "What should I watch?". With Supabase the `assistant` Edge Function asks Claude (supabase/functions/assistant);
// without it, or when that isn't available, matchWords() picks titles whose genres, moods and words fit the request.
// Either way the answer is { picks: [{ id, reason }], note, by: 'ai' | 'words' }.

export const MAX_PICKS = 5
export const MAX_REQUEST_LENGTH = 300
export const exampleRequests = [
  'Something tense under two hours',
  'A funny show to unwind with',
  'A mystery that keeps me guessing',
  'Something the whole family can watch',
]

// Everyday words for the catalog's genres
const genreWords = {
  Action: ['action', 'explosive', 'fight', 'fast'],
  Adventure: ['adventure', 'quest', 'journey', 'explore'],
  Comedy: ['funny', 'comedy', 'laugh', 'light', 'lighthearted', 'unwind'],
  Drama: ['drama', 'emotional', 'serious', 'moving'],
  Family: ['family', 'kids', 'children', 'everyone', 'wholesome'],
  Horror: ['scary', 'horror', 'creepy', 'frightening', 'spooky'],
  Mystery: ['mystery', 'mysterious', 'guessing', 'whodunit', 'puzzle', 'detective'],
  Romance: ['romance', 'romantic', 'love', 'date'],
  'Sci-Fi': ['sci-fi', 'scifi', 'science', 'future', 'space', 'robots'],
  Thriller: ['thriller', 'tense', 'suspense', 'suspenseful', 'edge', 'gripping'],
}
const stopWords = new Set(['a', 'an', 'and', 'the', 'to', 'with', 'me', 'my', 'i', 'that', 'something', 'some', 'of', 'for', 'on', 'in', 'watch', 'want', 'like', 'keeps', 'can', 'whole', 'under', 'than', 'less', 'hours', 'hour', 'two', 'one'])
const numberWords = { one: 1, two: 2, three: 3 }

const minutesOf = (runtime) => {
  const [, h = 0, m = 0] = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(runtime ?? '') ?? []
  return Number(h) * 60 + Number(m)
}

export function matchWords(request, titles) {
  const text = request.toLowerCase()
  const words = text.split(/[^a-z0-9-]+/).filter((w) => w && !stopWords.has(w))
  const wantsShow = /\b(show|series|episodes?|binge)\b/.test(text)
  const wantsMovie = /\b(movie|film)\b/.test(text)
  // "under two hours", "under 2 hours", "less than 90 minutes"
  const limit = /(?:under|less than)\s+(\d+|one|two|three)\s*(hours?|minutes?|mins?)/.exec(text)
  const maxMinutes = limit ? (numberWords[limit[1]] ?? Number(limit[1])) * (limit[2].startsWith('h') ? 60 : 1) : null

  const scored = titles.map((t) => {
    const reasons = []
    let score = 0
    for (const g of t.genres) {
      const hit = (genreWords[g] ?? [g.toLowerCase()]).find((w) => words.includes(w))
      if (hit) { score += 3; reasons.push(g.toLowerCase()) }
    }
    for (const m of t.mood ?? []) {
      if (words.includes(m.toLowerCase())) { score += 2; reasons.push(m.toLowerCase()) }
    }
    const blurb = `${t.title} ${t.synopsis}`.toLowerCase()
    for (const w of words) if (w.length > 3 && blurb.includes(w)) score += 1
    // A request with words in it ("tense") needs a title that matches them, not just one of the right length or type
    const asked = words.filter((w) => !/^(show|series|episodes?|binge|movie|film|minutes?|mins?|\d+)$/.test(w))
    if (asked.length && score === 0) return { t, score: 0, reasons }
    if (wantsShow) score += t.type === 'show' ? 2 : -5
    if (wantsMovie) score += t.type === 'movie' ? 2 : -5
    if (maxMinutes !== null) {
      if (t.type === 'movie' && minutesOf(t.runtime) <= maxMinutes) { score += 2; reasons.push(`${t.runtime} long`) }
      else score -= 5
    }
    return { t, score, reasons: [...new Set(reasons)] }
  })
  const picks = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || b.t.popularity - a.t.popularity)
    .slice(0, MAX_PICKS)
    .map(({ t, reasons }) => ({ id: t.id, reason: reasons.length ? `Matches ${reasons.join(', ')}.` : `Fits the words in your request.` }))
  return {
    picks,
    note: picks.length ? 'Picked by matching your words to each title’s genres and mood.' : 'Nothing matched those words. Try a genre or a mood, like “funny” or “tense”.',
    by: 'words',
  }
}

// Resolves to the answer; `unavailable` says why the words matcher stepped in. `titles`: what the profile may watch.
export async function askAssistant(request, { profileId, liked, titles }) {
  if (authBackend !== 'supabase') return matchWords(request, titles)
  let answer
  try {
    answer = await callFunction(await getSupabase(), 'assistant', { request, profileId, liked })
  } catch {
    // The client couldn't load (e.g. offline)
    answer = { error: 'The assistant isn’t available right now.' }
  }
  const { data, error } = answer
  if (error) return { ...matchWords(request, titles), unavailable: error }
  return { picks: data.picks, note: data.note, by: 'ai' }
}
