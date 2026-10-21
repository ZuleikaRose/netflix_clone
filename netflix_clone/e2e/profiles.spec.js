import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Profiles (in-memory accounts): each has its own name, avatar, maturity rating and library

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

async function addProfile(page, { name, avatar, maturity }) {
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Profile name').fill(name)
  if (avatar) await page.getByText(avatar, { exact: true }).click()
  if (maturity) await page.getByLabel('Maturity rating').selectOption(maturity)
  await page.locator('form').getByRole('button', { name: 'Add profile' }).click()
}

test('an account with one profile goes straight in; My Netflix shows the profile', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
  await navigateInApp(page, '/my-netflix')
  await expect(page.locator('.profile-card h2')).toHaveText('Alex')
  await page.getByRole('link', { name: 'Profiles', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Who’s watching?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alex', exact: true })).toBeVisible()
})

test('a Kids profile only sees kids’ titles, and each profile keeps its own lists', async ({ page }) => {
  // Alex saves a title
  await navigateInApp(page, '/title/after-dark')
  await page.getByRole('button', { name: 'My List' }).click()

  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await addProfile(page, { name: 'Kids', avatar: 'Green', maturity: 'kids' })
  await expect(page.getByRole('button', { name: 'Edit Kids' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Kids', exact: true }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.hero-title')).toHaveText(/LANTERN\s*ISLAND/)
  await expect(page.getByRole('heading', { name: /^Continue Watching/ })).toHaveCount(0)
  await navigateInApp(page, '/watchlist')
  await expect(page.locator('.profile-card h2')).toHaveText('Kids')
  await expect(page.getByText('Tap “My List” on any title to add it to your watch list.')).toBeVisible()

  // Back to Alex: the saved title is still there
  await page.getByRole('link', { name: 'Switch profile' }).click()
  await page.getByRole('button', { name: 'Alex', exact: true }).click()
  await navigateInApp(page, '/watchlist')
  await expect(page.getByRole('link', { name: 'After Dark', exact: true })).toBeVisible()
})

test('profile names must be unique, and an account has one to five profiles', async ({ page }) => {
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  // Only profile: it can't be deleted
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  await expect(page.getByRole('button', { name: 'Delete profile' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Profile name').fill('alex')
  await page.locator('form').getByRole('button', { name: 'Add profile' }).click()
  await expect(page.getByText('Another profile already has this name.')).toBeVisible()
  await expect(page.getByLabel('Profile name')).toBeFocused()
  await page.getByRole('button', { name: 'Cancel' }).click()

  for (const name of ['Sam', 'Jo', 'Riley', 'Max']) await addProfile(page, { name })
  await expect(page.locator('.profile-tile:not(.add)')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Add profile' })).toHaveCount(0)

  // Rename one, then delete it (two steps)
  await page.getByRole('button', { name: 'Edit Max' }).click()
  await page.getByLabel('Profile name').fill('Maxine')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.getByRole('button', { name: 'Edit Maxine' }).click()
  await page.getByRole('button', { name: 'Delete profile' }).click()
  await page.getByRole('button', { name: 'Yes, delete Maxine' }).click()
  await expect(page.getByRole('button', { name: 'Edit Maxine' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add profile' })).toBeVisible()
})

test('the maturity rating in Account belongs to the watching profile', async ({ page }) => {
  await navigateInApp(page, '/account')
  await expect(page.getByText('For Alex. Each profile has its own;')).toBeVisible()
  await page.getByLabel('Maturity rating').selectOption('kids')
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  await expect(page.getByLabel('Maturity rating')).toHaveValue('kids')
})
