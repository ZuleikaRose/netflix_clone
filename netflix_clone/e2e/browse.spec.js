import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo, tabBar } from './helpers.js'

// The catalog's own Home: without TMDB the carousel and Top 10 show catalog titles
test.use({ tmdb: 'fail' })

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

test('home shows the featured title, rows and type filters', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/BEHIND\s*THE GLASS/)
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()

  await page.getByRole('button', { name: 'Movies' }).click()
  await expect(page.getByRole('button', { name: 'Movies' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/AFTER\s*DARK/)
})

test('a title can be saved, favorited, rated, reviewed and played', async ({ page }) => {
  await page.getByRole('link', { name: '#1: After Dark' }).click()
  await expect(page).toHaveURL(/\/title\/after-dark$/)

  const myList = page.getByRole('button', { name: 'My List' })
  await myList.click()
  await expect(myList).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Favorite' }).click()

  await page.locator('label', { has: page.getByRole('radio', { name: '4 stars' }) }).click()
  await page.getByLabel('Write a review').fill('Creepy in the best way.')
  await page.getByRole('button', { name: 'Post review' }).click()
  await expect(page.locator('.review-list li').first()).toContainText('Creepy in the best way.')

  await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Now playing · After Dark' })).toBeVisible()

  await tabBar(page).getByRole('link', { name: 'My App' }).click()
  await expect(page.getByText('1 saved · 1 favorites · 1 rated')).toBeVisible()
  await expect(page.getByRole('link', { name: 'After Dark' })).toBeVisible()
})

test('liking a title adds a personalized row on Home', async ({ page }) => {
  await navigateInApp(page, '/title/after-dark')
  await page.getByRole('button', { name: 'Favorite' }).click()
  await tabBar(page).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { name: 'Because You Liked After Dark' })).toBeVisible()
})

test('search filters live in the URL', async ({ page }) => {
  await navigateInApp(page, '/search?q=thriller&type=movie')
  await expect(page.getByRole('heading', { name: '3 results' })).toBeVisible()
  await page.getByRole('button', { name: 'Horror', exact: true }).click()
  await expect(page).toHaveURL(/genre=Horror/)
  await expect(page.getByRole('heading', { name: '1 result' })).toBeVisible()
})

test('the maturity setting filters every catalog surface', async ({ page }) => {
  await navigateInApp(page, '/account')
  await page.getByLabel('Maturity rating').selectOption('kids')
  await tabBar(page).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/LANTERN\s*ISLAND/)

  await navigateInApp(page, '/title/after-dark')
  await expect(page.getByRole('heading', { name: 'Restricted' })).toBeVisible()
})

test('unknown routes show the 404 page', async ({ page }) => {
  await navigateInApp(page, '/does/not/exist')
  await expect(page.getByRole('heading', { name: 'Lost Your Way?' })).toBeVisible()
})
