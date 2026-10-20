import { expect, test } from '@playwright/test'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { supabaseConfigured as configured } from './ports.js'

// The `tmdb` Edge Function is mocked here, so these don't depend on TMDB's data or use up its quota
const tmdbEndpoint = '**/functions/v1/tmdb'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

const sample = (tmdbId, type, title, year, genres = ['Drama']) => ({
  id: `tmdb-${type}-${tmdbId}`, tmdbId, source: 'tmdb', title, type, year, maturity: 'NR', genres, mood: [], popularity: 80,
  rating: 8, isNew: false, top10: null, image: '/favicon.svg', backdrop: '/favicon.svg', tint: 'none', synopsis: `${title} overview.`,
  cast: [], crew: { director: null, writer: null }, reviews: [], tmdbUrl: `https://www.themoviedb.org/${type === 'show' ? 'tv' : 'movie'}/${tmdbId}`,
})

const matrix = sample(603, 'movie', 'The Matrix', 1999, ['Action', 'Science Fiction'])
const thrones = sample(1399, 'show', 'Game of Thrones', 2011, ['Drama', 'Sci-Fi & Fantasy'])
const lists = {
  trendingMovies: [matrix], trendingShows: [thrones],
  popularMovies: [sample(550, 'movie', 'Fight Club', 1999)], popularShows: [sample(1396, 'show', 'Breaking Bad', 2008)],
}
const details = {
  'movie:603': { ...matrix, maturity: 'R', runtime: '2h 16m', cast: ['Keanu Reeves', 'Carrie-Anne Moss'], crew: { director: 'Lana Wachowski, Lilly Wachowski', writer: null } },
  'show:1399': { ...thrones, maturity: 'TV-MA', seasons: 8, cast: ['Emilia Clarke'], crew: { director: 'David Benioff', writer: null } },
}

async function mockTmdb(page, { fail = false } = {}) {
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

test.describe('TMDB titles from the tmdb Edge Function', () => {
  test.skip(!configured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.development.local to run these')

  test('home shows trending and popular movies and TV shows, and the type chips filter them', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    for (const row of ['Trending Movies on TMDB', 'Trending TV Shows on TMDB', 'Popular Movies on TMDB', 'Popular TV Shows on TMDB']) {
      await expect(page.getByRole('heading', { name: row })).toBeVisible()
    }
    await expect(page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeVisible()

    await page.getByRole('button', { name: 'Movies', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trending Movies on TMDB' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Trending TV Shows on TMDB' })).toHaveCount(0)
  })

  test('a TMDB title opens its own page with TMDB details', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    await page.getByRole('link', { name: 'Game of Thrones' }).click()
    await expect(page).toHaveURL(/\/tmdb\/show\/1399$/)
    await expect(page.getByRole('heading', { name: 'GAME OF THRONES' })).toBeVisible()
    await expect(page.getByText('8 Seasons')).toBeVisible()
    await expect(page.getByText('TV-MA')).toBeVisible()
    await expect(page.getByText('Emilia Clarke')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Game of Thrones on TMDB' })).toHaveAttribute('href', 'https://www.themoviedb.org/tv/1399')
    // Not in the catalog: nothing to play or save
    await expect(page.getByRole('button', { name: /Play|My List/ })).toHaveCount(0)

    await navigateInApp(page, '/tmdb/movie/999')
    await expect(page.getByRole('heading', { name: /not found|lost/i }).first()).toBeVisible()
  })

  test('search adds TMDB results, filtered like the catalog results', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    await navigateInApp(page, '/search?q=e')
    await expect(page.getByRole('heading', { name: '2 more on TMDB' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'The Matrix' })).toBeVisible()

    await page.getByLabel('Type').selectOption('show')
    await expect(page.getByRole('heading', { name: '1 more on TMDB' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Game of Thrones' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'The Matrix' })).toHaveCount(0)
  })

  test('when TMDB fails, the app carries on without it', async ({ page }) => {
    await mockTmdb(page, { fail: true })
    await signInAsDemo(page)
    await expect(page.getByRole('heading', { name: 'New on Netflix' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /on TMDB$/ })).toHaveCount(0)

    await navigateInApp(page, '/tmdb/movie/603')
    await expect(page.getByText('TMDB isn’t available right now. Please try again later.')).toBeVisible()
  })
})
