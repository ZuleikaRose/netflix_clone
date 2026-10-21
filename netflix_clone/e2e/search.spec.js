import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Search: typo-tolerant matches, suggestions while typing and recent searches (in-memory build: the same trigram
// comparison as the database's search_titles())

const searchBox = (page) => page.getByRole('combobox', { name: 'Search titles, people, genres' })

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/search')
})

test('a misspelled title still finds it', async ({ page }) => {
  await searchBox(page).fill('nite shift')
  await expect(page.getByRole('heading', { name: 'No exact matches for “nite shift”. Did you mean…' })).toBeVisible()
  const similar = page.locator('section', { has: page.getByRole('heading', { name: /Did you mean/ }) })
  await expect(similar.getByRole('link', { name: 'Night Shift' })).toBeVisible()

  await searchBox(page).fill('zzzz')
  await expect(page.getByText('No matches for “zzzz”', { exact: false })).toBeVisible()
})

test('suggestions offer titles, people and genres, by keyboard or click', async ({ page }) => {
  await searchBox(page).fill('mara')
  const suggestions = page.getByRole('listbox', { name: 'Suggestions' })
  await expect(suggestions.getByRole('option', { name: /Mara Quinn/ })).toBeVisible()
  await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'true')
  await searchBox(page).press('ArrowDown')
  await expect(searchBox(page)).toHaveAttribute('aria-activedescendant', 'search-option-0')
  await searchBox(page).press('Enter')
  await expect(page).toHaveURL(/\/people\/Mara%20Quinn$/)

  await navigateInApp(page, '/search')
  await searchBox(page).fill('thril')
  await page.getByRole('option', { name: /Thriller\s*Genre/ }).click()
  await expect(page).toHaveURL(/\/search\?genre=Thriller$/)
  await expect(page.getByRole('button', { name: 'Thriller', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Escape closes the list
  await searchBox(page).fill('signal')
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible()
  await searchBox(page).press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('recent searches come back in an empty search box until cleared', async ({ page }) => {
  await searchBox(page).fill('signal')
  await searchBox(page).press('Enter')
  await navigateInApp(page, '/')
  await navigateInApp(page, '/search')
  await searchBox(page).focus()
  const recent = page.getByRole('listbox', { name: 'Recent searches' })
  await expect(recent.getByRole('option', { name: /signal/ })).toBeVisible()
  await recent.getByRole('option', { name: /signal/ }).click()
  await expect(page).toHaveURL(/\/search\?q=signal$/)

  await searchBox(page).fill('')
  await page.getByRole('button', { name: 'Clear recent searches' }).click()
  await searchBox(page).focus()
  await expect(page.getByRole('listbox')).toHaveCount(0)
})
