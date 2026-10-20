import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { supabaseConfigured as configured } from './ports.js'
import { mockTmdb, thrones } from './tmdbMock.js'

// The `tmdb` Edge Function is mocked (e2e/tmdbMock.js), so these don't depend on TMDB's data or use up its quota

test.describe('TMDB titles from the tmdb Edge Function', () => {
  test.skip(!configured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.development.local to run these')

  test('home shows new, trending and popular movies and TV shows, and the type chips filter them', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    for (const row of ['New on TMDB', 'Trending Movies on TMDB', 'Trending TV Shows on TMDB', 'Popular Movies on TMDB', 'Popular TV Shows on TMDB']) {
      await expect(page.getByRole('heading', { name: row })).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'New on Netflix' })).toHaveCount(0)
    const newRow = page.locator('.row-section', { has: page.getByRole('heading', { name: 'New on TMDB' }) })
    await expect(newRow.getByRole('link', { name: 'The Odyssey' })).toBeVisible()
    await expect(newRow.getByRole('link', { name: 'The Pitt' })).toBeVisible()
    await expect(page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeVisible()

    await page.getByRole('button', { name: 'Movies', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trending Movies on TMDB' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Trending TV Shows on TMDB' })).toHaveCount(0)
    await expect(newRow.getByRole('link', { name: 'The Odyssey' })).toBeVisible()
    await expect(newRow.getByRole('link', { name: 'The Pitt' })).toHaveCount(0)
  })

  test('Top 10 adds TMDB’s trending titles after the catalog’s ranked ones, numbered by place', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    const ranks = page.locator('.ranking .rank-card')
    const labels = () => ranks.evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')))
    // 4 ranked catalog titles, then the mock's trending movie and show, alternating (a real list fills it to 10)
    await expect.poll(labels).toEqual(['#1: After Dark', '#2: The Signal', '#3: The Veil', '#4: Dead Reckoning', '#5: The Matrix', '#6: Game of Thrones'])
    await expect(ranks.nth(4)).toHaveAttribute('href', '/tmdb/movie/603')

    await page.getByRole('button', { name: 'Movies', exact: true }).click()
    await expect.poll(labels).toEqual(['#1: After Dark', '#2: The Signal', '#3: Dead Reckoning', '#4: The Matrix'])
  })

  test('Top 10 stops at ten titles', async ({ page }) => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...thrones, id: `tmdb-show-${9000 + i}`, tmdbId: 9000 + i, title: `Show ${i + 1}` }))
    await page.route('**/functions/v1/tmdb', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { trendingMovies: [], trendingShows: many } })
    })
    await signInAsDemo(page)
    const ranks = page.locator('.ranking .rank-card')
    await expect(ranks).toHaveCount(10)
    await expect(ranks.last()).toHaveAttribute('aria-label', '#10: Show 6')
    await expect(ranks.last()).toHaveClass(/two-digits/)
  })

  test('a TMDB title opens its own page with TMDB details', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    await page.getByRole('link', { name: 'Game of Thrones', exact: true }).click()
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

  test('without a query, search browses TMDB titles by type, release year and sort', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    await navigateInApp(page, '/search')
    // Every title in TMDB's lists, once each: 2 new, 2 trending, 2 popular
    const tmdbResults = page.getByRole('region', { name: /on TMDB$/ }).locator('.poster-link')
    await expect(page.getByRole('heading', { name: '6 titles on TMDB' })).toBeVisible()

    await page.getByLabel('Type').selectOption('movie')
    await expect(page.getByRole('heading', { name: '3 titles on TMDB' })).toBeVisible()
    await expect(tmdbResults).toHaveText(['', '', ''])

    await page.getByLabel('Released').selectOption('2026')
    await expect(page.getByRole('heading', { name: '1 title on TMDB' })).toBeVisible()
    await expect(tmdbResults).toHaveAttribute('aria-label', 'The Odyssey')

    await page.getByLabel('Released').selectOption('earlier')
    await page.getByLabel('Sort by').selectOption('az')
    await expect.poll(() => tmdbResults.evaluateAll((links) => links.map((a) => a.getAttribute('aria-label'))))
      .toEqual(['Fight Club', 'The Matrix'])

    // Genre chips match TMDB's longer genre names too (Sci-Fi → Science Fiction)
    await page.getByLabel('Released').selectOption('')
    await page.getByRole('button', { name: 'Sci-Fi', exact: true }).click()
    await expect(tmdbResults).toHaveCount(1)
    await expect(tmdbResults).toHaveAttribute('aria-label', 'The Matrix')
  })

  test('when TMDB fails, the app carries on without it', async ({ page }) => {
    await mockTmdb(page, { fail: true })
    await signInAsDemo(page)
    await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /on TMDB$/ })).toHaveCount(0)
    await navigateInApp(page, '/search')
    await expect(page.getByRole('heading', { name: 'Top Searches' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /on TMDB$/ })).toHaveCount(0)

    await navigateInApp(page, '/tmdb/movie/603')
    await expect(page.getByText('TMDB isn’t available right now. Please try again later.')).toBeVisible()
  })
})
