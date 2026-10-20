// A stand-in for the `tmdb` Edge Function. Every test gets it (see test.js), so the suite never calls TMDB: no
// dependence on TMDB's data, and no hits against the function's per-IP rate limit, which the developer's own
// browser shares. tmdb.spec.js uses the same titles.
const tmdbEndpoint = '**/functions/v1/tmdb'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

const sample = (tmdbId, type, title, year, genres = ['Drama']) => ({
  id: `tmdb-${type}-${tmdbId}`, tmdbId, source: 'tmdb', title, type, year, maturity: 'NR', genres, mood: [], popularity: 80,
  rating: 8, isNew: false, top10: null, image: '/favicon.svg', backdrop: '/favicon.svg', tint: 'none', synopsis: `${title} overview.`,
  cast: [], crew: { director: null, writer: null }, reviews: [], tmdbUrl: `https://www.themoviedb.org/${type === 'show' ? 'tv' : 'movie'}/${tmdbId}`,
})

export const matrix = sample(603, 'movie', 'The Matrix', 1999, ['Action', 'Science Fiction'])
export const thrones = sample(1399, 'show', 'Game of Thrones', 2011, ['Drama', 'Sci-Fi & Fantasy'])
const odyssey = sample(1033462, 'movie', 'The Odyssey', 2026, ['Adventure', 'Fantasy'])
const pitt = sample(250307, 'show', 'The Pitt', 2025, ['Drama'])
const lists = {
  newMovies: [odyssey], newShows: [pitt],
  trendingMovies: [matrix], trendingShows: [thrones],
  popularMovies: [sample(550, 'movie', 'Fight Club', 1999)], popularShows: [sample(1396, 'show', 'Breaking Bad', 2008)],
}
const details = {
  'movie:603': { ...matrix, maturity: 'R', runtime: '2h 16m', cast: ['Keanu Reeves', 'Carrie-Anne Moss'], crew: { director: 'Lana Wachowski, Lilly Wachowski', writer: null } },
  'show:1399': { ...thrones, maturity: 'TV-MA', seasons: 8, cast: ['Emilia Clarke'], crew: { director: 'David Benioff', writer: null } },
}

// `fail: true` answers every call with a 500. Calling this again in a test replaces the earlier mock (newest route wins).
export async function mockTmdb(page, { fail = false } = {}) {
  await page.route(tmdbEndpoint, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (fail) return route.fulfill({ status: 500, headers: cors, json: { error: 'Something went wrong. Please try again.' } })
    const body = route.request().postDataJSON()
    const reply = {
      lists: () => lists,
      search: () => ({ results: [matrix, thrones].filter((t) => t.title.toLowerCase().includes(body.query.toLowerCase())) }),
      title: () => details[`${body.type}:${body.id}`] ? { title: details[`${body.type}:${body.id}`] } : null,
    }[body.action]?.()
    return reply ? route.fulfill({ headers: cors, json: reply }) : route.fulfill({ status: 404, headers: cors, json: { error: 'Title not found.' } })
  })
}
