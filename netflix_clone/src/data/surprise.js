import { notDisliked } from './reactions.js'

// "Surprise me": a random title the profile may watch (the caller passes useCatalog()'s filtered titles and the
// allowed TMDB titles), never one marked Not for me, and not the title picked last time unless it's the only one.
// `type` narrows it to 'movie' or 'show'. `random` is injectable for tests. Returns null when nothing qualifies.
export function pickSurprise(titles, reactions, { type = null, previous = null, random = Math.random } = {}) {
  const pool = titles.filter((t) => (!type || t.type === type) && notDisliked(reactions)(t))
  const fresh = pool.length > 1 ? pool.filter((t) => t.id !== previous) : pool
  return fresh.length ? fresh[Math.floor(random() * fresh.length)] : null
}
