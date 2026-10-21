import { FUZZY_THRESHOLD, wordSimilarity } from './fuzzy.js'
import { personPath, splitNames } from './people.js'

const MAX_SUGGESTIONS = 6
const limits = { title: 3, person: 2, genre: 1 }

// Suggestions while typing: titles, people and genres from the catalog, each { id, kind, label, to?, genre? }.
// A name containing the query ranks first, then close spellings.
export function suggestionsFor(titles, query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const score = (text) => (text.toLowerCase().includes(q) ? 1 + (text.toLowerCase().startsWith(q) ? 1 : 0) : wordSimilarity(q, text))
  const best = (items, kind) => items
    .map((item) => ({ ...item, score: score(item.label) }))
    .filter((item) => item.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limits[kind])

  const people = [...new Set(titles.flatMap((t) => [...t.cast, ...splitNames(t.crew.director), ...splitNames(t.crew.writer)]))]
  const genres = [...new Set(titles.flatMap((t) => t.genres))]
  return [
    ...best(titles.map((t) => ({ id: `title:${t.id}`, kind: 'title', label: t.title, to: `/title/${t.id}` })), 'title'),
    ...best(people.map((name) => ({ id: `person:${name}`, kind: 'person', label: name, to: personPath(name) })), 'person'),
    ...best(genres.map((g) => ({ id: `genre:${g}`, kind: 'genre', label: g, genre: g })), 'genre'),
  ].slice(0, MAX_SUGGESTIONS)
}
