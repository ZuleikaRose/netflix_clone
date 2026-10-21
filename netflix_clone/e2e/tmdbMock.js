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
// The tmdb function looks up list items' certifications; this one has one, the rest stay 'NR'
const odyssey = { ...sample(1033462, 'movie', 'The Odyssey', 2026, ['Adventure', 'Fantasy']), maturity: 'PG-13' }
export const inception = { ...sample(27205, 'movie', 'Inception', 2010, ['Action', 'Science Fiction']), maturity: 'PG-13' }
const pitt = sample(250307, 'show', 'The Pitt', 2025, ['Drama'])
// Coming soon, far enough ahead to stay in the future
export const premiere = { ...sample(1100, 'movie', 'The Premiere', 2030, ['Drama']), maturity: 'PG-13', releaseDate: '2030-06-14' }
const lists = {
  newMovies: [odyssey], newShows: [pitt],
  trendingMovies: [matrix], trendingShows: [thrones],
  popularMovies: [sample(550, 'movie', 'Fight Club', 1999)], popularShows: [sample(1396, 'show', 'Breaking Bad', 2008)],
  upcomingMovies: [premiere],
}
const details = {
  'movie:1100': { ...premiere, runtime: '1h 50m', trailer: null, providers: null },
  'movie:603': {
    ...matrix, maturity: 'R', runtime: '2h 16m', cast: ['Keanu Reeves', 'Carrie-Anne Moss'], crew: { director: 'Lana Wachowski, Lilly Wachowski', writer: null },
    people: {
      cast: [{ id: 6384, name: 'Keanu Reeves', role: 'Neo', photo: null }, { id: 530, name: 'Carrie-Anne Moss', role: 'Trinity', photo: null }],
      crew: [{ id: 9340, name: 'Lana Wachowski', job: 'Director' }, { id: 9339, name: 'Lilly Wachowski', job: 'Director' }],
    },
    trailer: { key: 'vKQi3bBA1y8', name: 'The Matrix (1999) Official Trailer' },
    providers: { link: 'https://www.themoviedb.org/movie/603/watch?locale=US', stream: [{ name: 'Max', logo: '/favicon.svg' }], rent: [{ name: 'Apple TV', logo: '/favicon.svg' }], buy: [] },
  },
  'show:1399': {
    ...thrones, maturity: 'TV-MA', seasons: 8, cast: ['Emilia Clarke'], crew: { director: 'David Benioff', writer: null }, trailer: null, providers: null,
    seasonList: [{ number: 1, name: 'Season 1', episodes: 2, year: 2011 }, { number: 2, name: 'Season 2', episodes: 1, year: 2012 }],
  },
}
const episode = (number, name, airDate) => ({ number, name, overview: `${name} overview.`, airDate, runtime: '58m', still: '/favicon.svg', rating: 8 })
const seasons = {
  '1399:1': { number: 1, name: 'Season 1', overview: null, episodes: [episode(1, 'Winter Is Coming', '2011-04-17'), episode(2, 'The Kingsroad', '2011-04-24')] },
  '1399:2': { number: 2, name: 'Season 2', overview: null, episodes: [episode(1, 'The North Remembers', '2012-04-01')] },
}
// A long biography, so the page folds it
const people = {
  6384: {
    id: 6384, name: 'Keanu Reeves', photo: '/favicon.svg', knownFor: 'Acting', born: '1964-09-02', died: null, birthplace: 'Beirut, Lebanon',
    biography: `${'Keanu Charles Reeves is a Canadian actor. '.repeat(14)}\n\nHe is known for his roles in action films.`,
    tmdbUrl: 'https://www.themoviedb.org/person/6384',
    credits: [{ ...matrix, maturity: 'R', role: 'Neo' }, { ...thrones, maturity: 'TV-MA', role: 'Narrator' }, { ...inception, role: null }],
  },
}
const recommendations = { 'movie:603': [inception, matrix], 'show:1399': [] }

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
      recommendations: () => ({ results: recommendations[`${body.type}:${body.id}`] ?? [] }),
      season: () => seasons[`${body.id}:${body.season}`] ? { season: seasons[`${body.id}:${body.season}`] } : { status: 404, error: 'Season not found.' },
      person: () => people[body.id] ? { person: people[body.id] } : { status: 404, error: 'Person not found.' },
      save: () => details[`${body.type}:${body.id}`] ? { title: details[`${body.type}:${body.id}`] } : null,
    }[body.action]?.()
    if (reply?.status) return route.fulfill({ status: reply.status, headers: cors, json: { error: reply.error } })
    return reply ? route.fulfill({ headers: cors, json: reply }) : route.fulfill({ status: 404, headers: cors, json: { error: 'Title not found.' } })
  })
}
