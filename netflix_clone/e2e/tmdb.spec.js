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

  test('Top 10 is TMDB’s trending movies and TV shows, alternating and numbered by place', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    const ranks = page.locator('.ranking .rank-card')
    const labels = () => ranks.evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')))
    // The mock has one trending movie and one show (a real list fills it to 10); no catalog titles
    await expect.poll(labels).toEqual(['#1: The Matrix', '#2: Game of Thrones'])
    await expect(ranks.first()).toHaveAttribute('href', '/tmdb/movie/603')

    await page.getByRole('button', { name: 'TV Shows', exact: true }).click()
    await expect.poll(labels).toEqual(['#1: Game of Thrones'])
  })

  test('the featured carousel shows TMDB’s popular movies and TV shows', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    const heroTitle = page.locator('.hero-title')
    await expect(heroTitle).toHaveText(/FIGHT\s*CLUB/)
    await expect(page.locator('.hero .eyebrow')).toHaveText('FILM · TMDB')
    // TMDB titles can't be played here: More Info opens their page
    await expect(page.locator('.hero').getByRole('button', { name: /Play$/ })).toHaveCount(0)
    await expect(page.locator('.hero').getByRole('link', { name: 'More Info' })).toHaveAttribute('href', '/tmdb/movie/550')

    await page.getByRole('button', { name: 'Next featured title' }).click()
    await expect(heroTitle).toHaveText(/BREAKING\s*BAD/)
    await page.locator('.hero').getByRole('button', { name: 'My List' }).click()
    await expect(page.locator('.hero').getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
    await navigateInApp(page, '/watchlist')
    await expect(page.getByRole('link', { name: 'Breaking Bad', exact: true })).toHaveAttribute('href', '/tmdb/show/1396')
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
    await expect(ranks.last()).toHaveAttribute('aria-label', '#10: Show 10')
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
    // No sample clip for TMDB titles: nothing to play
    await expect(page.getByRole('button', { name: /^\s*(Play|Resume)$/ })).toHaveCount(0)

    await navigateInApp(page, '/tmdb/movie/999')
    await expect(page.getByRole('heading', { name: /not found|lost/i }).first()).toBeVisible()
  })

  test('a TMDB title can go on My List and Favorites, and opens from there', async ({ page }) => {
    await mockTmdb(page)
    await signInAsDemo(page)
    await navigateInApp(page, '/tmdb/movie/603')
    const myList = page.getByRole('button', { name: 'My List' })
    const favorite = page.getByRole('button', { name: 'Favorite' })
    await expect(myList).toHaveAttribute('aria-pressed', 'false')
    await myList.click()
    await favorite.click()
    await expect(myList).toHaveAttribute('aria-pressed', 'true')
    await expect(favorite).toHaveAttribute('aria-pressed', 'true')

    await navigateInApp(page, '/watchlist')
    await expect(page.getByRole('link', { name: 'The Matrix', exact: true })).toHaveAttribute('href', '/tmdb/movie/603')
    await navigateInApp(page, '/favorites')
    await page.getByRole('link', { name: 'The Matrix', exact: true }).click()
    await expect(page).toHaveURL(/\/tmdb\/movie\/603$/)

    await page.getByRole('button', { name: 'My List' }).click()
    await expect(page.getByRole('button', { name: 'My List' })).toHaveAttribute('aria-pressed', 'false')
    await navigateInApp(page, '/watchlist')
    await expect(page.getByRole('link', { name: 'The Matrix', exact: true })).toHaveCount(0)
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
    // The carousel and Top 10 fall back to the catalog's own titles
    await expect(page.locator('.hero-title')).toHaveText(/BEHIND\s*THE GLASS/)
    await expect(page.locator('.ranking .rank-card').first()).toHaveAttribute('aria-label', '#1: After Dark')
    await expect(page.getByRole('heading', { name: /on TMDB$/ })).toHaveCount(0)
    await navigateInApp(page, '/search')
    await expect(page.getByRole('heading', { name: 'Top Searches' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /on TMDB$/ })).toHaveCount(0)

    await navigateInApp(page, '/tmdb/movie/603')
    await expect(page.getByText('TMDB isn’t available right now. Please try again later.')).toBeVisible()
  })
})

test.describe('TMDB trailers, where to watch, reviews and recommendations', () => {
  test.skip(!configured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.development.local to run these')

  test('a TMDB title plays its YouTube trailer on request and lists where to watch it', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/tmdb/movie/603')
    // Nothing loads from YouTube until the viewer asks
    await expect(page.locator('iframe')).toHaveCount(0)
    await page.getByRole('button', { name: 'Play trailer' }).click()
    const trailer = page.locator('iframe[title="The Matrix trailer"]')
    await expect(trailer).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/vKQi3bBA1y8\?/)
    await page.getByRole('button', { name: 'Close trailer' }).click()
    await expect(trailer).toHaveCount(0)

    const providers = page.getByRole('region', { name: 'Where to watch in the U.S.' })
    await expect(providers.getByRole('heading', { name: 'Stream' })).toBeVisible()
    await expect(providers.getByText('Max', { exact: true })).toBeVisible()
    await expect(providers.getByText('Apple TV', { exact: true })).toBeVisible()
    await expect(providers.getByRole('heading', { name: 'Buy' })).toHaveCount(0)
    await expect(providers.getByRole('link', { name: 'JustWatch' })).toBeVisible()

    // A title without a trailer or providers says so instead
    await navigateInApp(page, '/tmdb/show/1399')
    await expect(page.getByRole('heading', { name: 'GAME OF THRONES' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play trailer' })).toHaveCount(0)
    await expect(page.getByText('No streaming, rental or purchase options are listed for Game of Thrones right now.')).toBeVisible()
  })

  test('members can rate and review a TMDB title', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/tmdb/movie/603')
    await expect(page.getByText('No reviews yet — be the first.')).toBeVisible()
    await page.locator('.stars label').nth(3).click()
    await expect(page.getByRole('radio', { name: '4 stars' })).toBeChecked()
    await page.getByLabel('Write a review').fill('Still holds up.')
    await page.getByRole('button', { name: 'Post review' }).click()
    await expect(page.locator('.review-list')).toContainText('Still holds up.')
    await expect(page.locator('.review-list').getByLabel('4 out of 5 stars')).toBeVisible()
  })

  test('TMDB recommends titles on the title page and, after saving one, on Home', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/tmdb/movie/603')
    const moreLikeThis = page.locator('.row-section', { has: page.getByRole('heading', { name: 'More Like This' }) })
    await expect(moreLikeThis.getByRole('link', { name: 'Inception' })).toHaveAttribute('href', '/tmdb/movie/27205')

    await expect(page.getByRole('heading', { name: /^Because You Saved/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Favorite' }).click()
    await navigateInApp(page, '/')
    const row = page.locator('.row-section', { has: page.getByRole('heading', { name: 'Because You Saved The Matrix' }) })
    await expect(row.getByRole('link', { name: 'Inception' })).toBeVisible()
    // The saved title itself isn't recommended back
    await expect(row.getByRole('link', { name: 'The Matrix' })).toHaveCount(0)
  })

  test('a restricted profile sees the TMDB titles whose certification fits its setting', async ({ page }) => {
    await signInAsDemo(page)
    const newRow = page.locator('.row-section', { has: page.getByRole('heading', { name: 'New on TMDB' }) })
    await expect(newRow.getByRole('link', { name: 'The Pitt' })).toBeVisible()
    await navigateInApp(page, '/account')
    await page.getByLabel('Maturity rating').selectOption('teen')
    await navigateInApp(page, '/')
    await expect(newRow.getByRole('link', { name: 'The Odyssey' })).toBeVisible() // PG-13
    await expect(newRow.getByRole('link', { name: 'The Pitt' })).toHaveCount(0) // not rated
    await expect(page.getByRole('heading', { name: 'Trending Movies on TMDB' })).toHaveCount(0)
  })
})
