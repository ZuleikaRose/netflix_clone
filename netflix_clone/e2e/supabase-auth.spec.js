import { expect, test } from '@playwright/test'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { SUPABASE_E2E_PORT, supabaseAuthSettings, supabaseConfigured } from './ports.js'

// Real Supabase Auth against the dev project (eagle_platoon_dev). Each run creates a couple of accounts there: demo
// accounts and e2e-…@example.com sign-ups are deleted by the hourly cleanup job after 24 hours.
// Desktop only, to keep the number of sign-ins (rate limited per IP) low.
test.use({ baseURL: `http://localhost:${SUPABASE_E2E_PORT}` })
test.skip(!supabaseConfigured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.development.local to run these')
test.skip(({ viewport }) => viewport.width < 1000, 'Runs once, on the desktop project')

// Resolves once the app has saved a row to `table`
const saved = (page, table) => page.waitForResponse((r) => r.url().includes(`/rest/v1/${table}`) && ['POST', 'PATCH'].includes(r.request().method()) && r.ok())

async function signIn(page, email, password) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

async function signOut(page) {
  await navigateInApp(page, '/logout')
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await page.getByRole('link', { name: 'Sign In Again' }).click()
}

test('the demo button creates a private demo account, and its changes are saved', async ({ page }) => {
  await signInAsDemo(page)
  // The demo-account Edge Function adds two titles to the new account's watch list
  await navigateInApp(page, '/my-netflix')
  await expect(page.getByText('2 saved · 0 favorites · 0 rated')).toBeVisible()

  await navigateInApp(page, '/title/after-dark')
  const listSaved = saved(page, 'watch_list_tables')
  await page.getByRole('button', { name: 'My List' }).click()
  await listSaved
  const ratingSaved = saved(page, 'review')
  await page.locator('label', { has: page.getByRole('radio', { name: '4 stars' }) }).click()
  await ratingSaved

  await navigateInApp(page, '/account')
  const email = await page.getByRole('textbox', { name: 'Email' }).inputValue()
  expect(email).toMatch(/^demo-[a-z0-9]+@example\.com$/)
  const password = await page.locator('.demo-credentials code').textContent()

  // A new session (the same as after a reload) loads everything back from the database
  await signOut(page)
  await expect(page.locator('.demo-credentials')).toContainText(email)
  await signIn(page, email, password)
  await navigateInApp(page, '/my-netflix')
  await expect(page.getByText('3 saved · 0 favorites · 1 rated')).toBeVisible()
})

test('title pages show members’ reviews from the database', async ({ page }) => {
  await signInAsDemo(page, '/title/after-dark')
  await expect(page.locator('.review-list')).toContainText('Simple premise, genuinely scary execution.')
  await expect(page.locator('.review-list')).toContainText('Priya')
})

test('sign up, apply a promo code, review, then delete the account', async ({ page }) => {
  const settings = await supabaseAuthSettings()
  test.skip(!settings.mailer_autoconfirm, 'The dev project still requires email confirmation (Authentication → Sign In / Providers → Email)')

  const email = `e2e-${Date.now()}@example.com`
  // A fresh throwaway password each run, so none is kept in the repository
  // (with every kind of character, for projects that require them)
  const password = `E2e-${crypto.randomUUID()}`
  await page.goto('/signup?ref=JORDAN7Q2K')
  await expect(page.getByText('code JORDAN7Q2K')).toBeVisible()
  await page.getByLabel('Name').fill('Robin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByText('Premium', { exact: true }).click()
  await page.getByRole('button', { name: 'Start Watching' }).click()
  await expect(page).toHaveURL(/\/$/)

  // FAMILY15 is checked by the apply-promo Edge Function: Premium only
  await navigateInApp(page, '/info/promotions')
  await page.getByLabel('Promo code').fill('family15')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('.membership')).toContainText('FAMILY15 applied')

  await navigateInApp(page, '/title/night-shift')
  await page.getByLabel('Write a review').fill('Saved straight to the database.')
  const reviewSaved = saved(page, 'review')
  await page.getByRole('button', { name: 'Post review' }).click()
  await reviewSaved

  await signOut(page)
  await signIn(page, email, password)
  await expect(page).not.toHaveURL(/\/login$/)
  await navigateInApp(page, '/info/promotions')
  await expect(page.locator('.membership')).toContainText('FAMILY15 applied')
  await navigateInApp(page, '/title/night-shift')
  await expect(page.locator('.review-list li').first()).toContainText('Robin')
  await expect(page.locator('.review-list li').first()).toContainText('Saved straight to the database.')

  // Delete account: cancel the membership, then confirm with email and password (delete-account Edge Function)
  await navigateInApp(page, '/account')
  await page.getByRole('button', { name: 'Cancel membership' }).click()
  const cancelled = saved(page, 'netflix_tables')
  await page.getByRole('button', { name: 'Yes, cancel membership' }).click()
  await cancelled
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.getByLabel('Type your email address to confirm').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Delete my account access' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toHaveText(/Your account access has been deleted/)

  await signIn(page, email, password)
  await expect(page.getByRole('alert')).toHaveText(/access has been removed/)
})
