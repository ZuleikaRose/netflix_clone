import { localDay } from './notifications.js'

// Screen-time limits (migration ..._screen_time): a daily viewing limit per profile, meant for Kids profiles. Only
// profiles with a limit count their time. The limit and extra time need the account password; the database checks it.
export const LIMIT_CHOICES = [30, 60, 90, 120, 180, 240] // minutes, as the database allows
export const EXTRA_MINUTES = 30 // what "Allow more time" adds
export const TICK_SECONDS = 5 // the player counts in steps this long while it plays
export const SAVE_EVERY_SECONDS = 15 // and saves them this often (the database takes up to 60 at a time)

export const formatMinutes = (minutes) => {
  if (minutes < 60) return `${minutes} minutes`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${Math.floor(hours)} h ${minutes % 60} min`
}

// A day's usage ({ day, seconds, extraSeconds }) → seconds left today, or null without a limit
export function secondsLeft(limitMinutes, usage) {
  if (!limitMinutes) return null
  return Math.max(0, limitMinutes * 60 + usage.extraSeconds - usage.seconds)
}

export const emptyUsage = (day) => ({ day, seconds: 0, extraSeconds: 0 })
export const toUsage = (row) => ({ day: row.day, seconds: row.seconds, extraSeconds: row.extra_seconds })

// The last seven local days (YYYY-MM-DD), oldest first, ending today. The database keeps eight days of rows.
export function lastSevenDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i)))
}
// One usage per day of `days` (days with no row watched nothing)
export const weekOf = (days, usages) => days.map((day) => usages.find((u) => u.day === day) ?? emptyUsage(day))
export const dayLabel = (day, today) => (day === today
  ? 'Today'
  : new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
export function formatWatched(seconds) {
  const minutes = Math.round(seconds / 60)
  if (minutes === 0) return 'None'
  return minutes === 1 ? '1 minute' : formatMinutes(minutes)
}
