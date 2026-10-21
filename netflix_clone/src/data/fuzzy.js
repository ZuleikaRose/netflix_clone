// Typo-tolerant matching like Postgres's pg_trgm (which search_titles() uses with Supabase): words are split into
// three-letter pieces ("  ni", " nig", "nig"…), and two texts are as similar as the share of pieces they have in common.

export const FUZZY_THRESHOLD = 0.4

function trigramsOf(text) {
  const trigrams = new Set()
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const padded = `  ${word} `
    for (let i = 0; i < padded.length - 2; i++) trigrams.add(padded.slice(i, i + 3))
  }
  return trigrams
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared += 1
  return shared / (a.size + b.size - shared)
}

// How closely the query matches the best run of words in the text, 0–1 ("nite shift" in "Night Shift" ≈ 0.53)
export function wordSimilarity(query, text) {
  const q = trigramsOf(query)
  const words = text.split(/\s+/).filter(Boolean)
  let best = 0
  for (let start = 0; start < words.length; start++) {
    for (let end = start; end < words.length; end++) {
      best = Math.max(best, similarity(q, trigramsOf(words.slice(start, end + 1).join(' '))))
    }
  }
  return best
}

// Titles whose name or cast is close to the query, best first: [{ title, score }]
export function fuzzyTitles(titles, query) {
  return titles
    .map((title) => ({ title, score: Math.max(wordSimilarity(query, title.title), ...title.cast.map((c) => wordSimilarity(query, c))) }))
    .filter((m) => m.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.title.popularity - a.title.popularity)
}
