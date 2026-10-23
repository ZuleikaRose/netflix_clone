import { locale } from '../i18n/index.js'

// Catalog people (the built-in titles' fictional cast and crew) live at /people/:name; TMDB people at /tmdb/person/:id
export const personPath = (name) => `/people/${encodeURIComponent(name)}`

// "Lana Wachowski, Lilly Wachowski" → each name
export const splitNames = (names) => (names ? names.split(',').map((n) => n.trim()).filter(Boolean) : [])

// The catalog titles a person is in, each with what they did on it ("Acting", "Director", "Writer")
export function catalogCredits(titles, name) {
  return titles
    .map((title) => ({
      title,
      roles: [
        title.cast.includes(name) && 'Acting',
        splitNames(title.crew.director).includes(name) && 'Director',
        splitNames(title.crew.writer).includes(name) && 'Writer',
      ].filter(Boolean),
    }))
    .filter((c) => c.roles.length)
    .sort((a, b) => b.title.popularity - a.title.popularity)
}

// "1964-09-02" → "September 2, 1964"
export const formatDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(locale(), { dateStyle: 'long' })

// Age in whole years on `until` (a date string) or today
export function ageOn(born, until) {
  const start = new Date(`${born}T00:00:00`)
  const end = until ? new Date(`${until}T00:00:00`) : new Date()
  const hadBirthday = end.getMonth() > start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() >= start.getDate())
  return end.getFullYear() - start.getFullYear() - (hadBirthday ? 0 : 1)
}
