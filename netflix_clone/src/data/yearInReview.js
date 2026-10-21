import { findEpisode } from './episodes.js'

// Year in Review. The viewing history for one profile and year is first summed up as
//   { days: ['YYYY-MM-DD', …] (each day something was watched), months: [12 counts of viewings],
//     titles: [{ titleId, viewings, episodes: [episode numbers watched] }] }
// by public.year_in_review() with Supabase, or summarizeHistory() in memory; reviewYear() turns that into the stats
// the page shows. A viewing is one row of history: a title (and episode) on one day.

export function summarizeHistory(entries, year) {
  const inYear = entries.filter((e) => e.day.startsWith(`${year}-`))
  const months = Array(12).fill(0)
  const titles = new Map()
  for (const e of inYear) {
    months[Number(e.day.slice(5, 7)) - 1] += 1
    const t = titles.get(e.titleId) ?? { titleId: e.titleId, viewings: 0, episodes: [] }
    t.viewings += 1
    if (e.episode && !t.episodes.includes(e.episode)) t.episodes.push(e.episode)
    titles.set(e.titleId, t)
  }
  return { days: [...new Set(inYear.map((e) => e.day))].sort(), months, titles: [...titles.values()] }
}

// The years a profile has history in, newest first (always including this one)
export const historyYears = (entries, thisYear) => [...new Set([thisYear, ...entries.map((e) => Number(e.day.slice(0, 4)))])].sort((a, b) => b - a)

// '1h 52m' → 112
const runtimeMinutes = (runtime) => {
  const [, h = 0, m = 0] = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(runtime ?? '') ?? []
  return Number(h) * 60 + Number(m)
}

// The most frequent keys of { key: count }, highest first (ties alphabetical)
const top = (counts, n) => Object.entries(counts).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, n).map(([key]) => key)

// Longest run of consecutive days in a sorted list of 'YYYY-MM-DD'
function longestStreak(days) {
  let best = 0
  let run = 0
  let previous = null
  for (const day of days) {
    const time = Date.parse(`${day}T12:00:00Z`)
    run = previous !== null && time - previous === 86_400_000 ? run + 1 : 1
    best = Math.max(best, run)
    previous = time
  }
  return best
}

const monthName = (index) => new Date(2000, index, 1).toLocaleDateString('en-US', { month: 'long' })

// Stats for the page, or null when nothing was watched that year. findTitle(id) → the title (or undefined if it's
// gone from the catalog, in which case it still counts but adds no genres, cast or minutes).
export function reviewYear(summary, findTitle) {
  if (!summary.days.length) return null
  const genres = {}
  const people = {}
  let minutes = 0
  let episodes = 0
  let mostWatched = null
  for (const t of summary.titles) {
    const title = findTitle(t.titleId)
    if (title?.type === 'show') {
      episodes += t.episodes.length
      minutes += t.episodes.reduce((sum, n) => sum + (findEpisode(title, n)?.minutes ?? 0), 0)
    } else if (title) {
      minutes += runtimeMinutes(title.runtime) * t.viewings
    }
    for (const g of title?.genres ?? []) genres[g] = (genres[g] ?? 0) + t.viewings
    for (const name of title?.cast ?? []) people[name] = (people[name] ?? 0) + t.viewings
    if (title && (!mostWatched || t.viewings > mostWatched.viewings)) mostWatched = { title, viewings: t.viewings }
  }
  const busiest = summary.months.indexOf(Math.max(...summary.months))
  return {
    titles: summary.titles.length,
    episodes,
    hours: Math.round(minutes / 60),
    days: summary.days.length,
    streak: longestStreak(summary.days),
    busiestMonth: monthName(busiest),
    topGenres: top(genres, 3),
    topPerson: top(people, 1)[0] ?? null,
    mostWatched: mostWatched?.title ?? null,
  }
}

// A short summary for sharing
export function shareText(year, stats) {
  const parts = [
    `My ${year} on Netflix Clone: ${stats.titles} ${stats.titles === 1 ? 'title' : 'titles'}`,
    stats.episodes ? `${stats.episodes} ${stats.episodes === 1 ? 'episode' : 'episodes'}` : null,
    `about ${stats.hours} ${stats.hours === 1 ? 'hour' : 'hours'} watched.`,
  ].filter(Boolean)
  return [
    parts.join(', '),
    stats.topGenres.length ? `Top genre: ${stats.topGenres[0]}.` : null,
    stats.mostWatched ? `Most watched: ${stats.mostWatched.title}.` : null,
  ].filter(Boolean).join(' ')
}
