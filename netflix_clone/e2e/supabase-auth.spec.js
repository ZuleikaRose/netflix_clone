import { expect, test } from './test.js'
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

test('the demo button creates a private demo account; its changes are saved and a reload keeps it signed in', async ({ page }) => {
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

  // Accessibility menu settings are saved for the member too
  const a11ySaved = saved(page, 'accessibility_settings')
  await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
  await page.getByRole('dialog', { name: 'Accessibility' }).getByRole('radio', { name: '130%' }).check()
  await a11ySaved
  await page.keyboard.press('Escape')

  await navigateInApp(page, '/account')
  const email = await page.getByRole('textbox', { name: 'Email' }).inputValue()
  expect(email).toMatch(/^demo-[a-z0-9]+@example\.com$/)
  const password = await page.locator('.demo-credentials code').textContent()

  // A reload keeps the member signed in on the same page and loads everything back from the database
  await page.reload()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(email)
  await expect(page.locator('.demo-credentials code')).toHaveText(password)
  await expect(page.locator('html')).toHaveAttribute('data-a11y-text-size', '130')
  await navigateInApp(page, '/my-netflix')
  await expect(page.getByText('3 saved · 0 favorites · 1 rated')).toBeVisible()

  // Signing out clears the saved session, so the next reload stays signed out; signing in brings it all back
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await signIn(page, email, password)
  await navigateInApp(page, '/my-netflix')
  await expect(page.getByText('3 saved · 0 favorites · 1 rated')).toBeVisible()
})

// Reset emails are mocked: Supabase's built-in email only reaches the project's team until custom SMTP is set up
test('forgot password sends a reset email, and the emailed link sets a new password', async ({ page }) => {
  let recoverRequest
  await page.route('**/auth/v1/recover*', async (route) => {
    recoverRequest = route.request()
    await route.fulfill({ json: {} })
  })
  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill('Robin@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If there’s an account for robin@example.com')
  await expect(page.getByRole('link', { name: 'Open the reset link' })).toHaveCount(0)
  expect(recoverRequest.postDataJSON().email).toBe('robin@example.com')
  expect(decodeURIComponent(recoverRequest.url())).toContain(`redirect_to=http://localhost:${SUPABASE_E2E_PORT}/reset-password`)

  // The emailed link carries a one-time recovery session in the URL hash
  const user = { id: 'b0000000-0000-4000-8000-0000000000e2', email: 'robin@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  const claims = { sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }
  const accessToken = [{ alg: 'HS256', typ: 'JWT' }, claims].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + `.${Buffer.from('test-signature').toString('base64url')}`
  let newPassword
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() === 'PUT') newPassword = route.request().postDataJSON().password
    await route.fulfill({ json: user })
  })
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204 }))

  await page.goto(`/reset-password#access_token=${accessToken}&refresh_token=e2e-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await expect(page.getByText('For robin@example.com.')).toBeVisible()
  expect(page.url()).not.toContain('access_token')
  await page.getByLabel('New password', { exact: true }).fill('Brand-new-pass-42')
  await page.getByLabel('Confirm new password').fill('Brand-new-pass-42')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toHaveText('Your password has been changed. Sign in with your new password.')
  expect(newPassword).toBe('Brand-new-pass-42')
})

test('an expired reset link asks for a new one', async ({ page }) => {
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByRole('alert')).toHaveText('This reset link has expired. Please request a new one.')
  await page.getByRole('link', { name: 'Request a new link' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
})

test('title pages show members’ reviews from the database; a list shared by link opens for visitors', async ({ page, browser }) => {
  await signInAsDemo(page, '/title/after-dark')
  await expect(page.locator('.review-list')).toContainText('Simple premise, genuinely scary execution.')
  await expect(page.locator('.review-list')).toContainText('Priya')

  // A custom list is saved, survives a reload, and once shared opens for someone who isn't signed in
  await page.getByText('Add to a list').click()
  const listSaved = saved(page, 'custom_lists')
  await page.getByLabel('New list name').fill('Scary nights')
  await page.getByRole('button', { name: 'Create list' }).click()
  await listSaved
  await expect(page.getByRole('checkbox', { name: 'Scary nights' })).toBeChecked()
  await page.waitForResponse((r) => r.url().includes('/rest/v1/custom_list_items') && r.ok())
  await page.reload()
  await navigateInApp(page, '/lists')
  await page.getByRole('link', { name: /Scary nights\s*1 title/ }).click()
  const shared = saved(page, 'custom_lists')
  await page.getByRole('switch', { name: /Share with a link/ }).check()
  await shared
  const link = await page.getByLabel('Share link').inputValue()

  const visitor = await browser.newContext()
  const visit = await visitor.newPage()
  await visit.goto(link)
  await expect(visit.getByRole('heading', { name: 'Scary nights', level: 1 })).toBeVisible()
  await expect(visit.getByText(/^A list by .+ · 1 title$/)).toBeVisible()
  await expect(visit.getByRole('link', { name: 'After Dark' })).toBeVisible()
  await expect(visit.getByRole('link', { name: 'Join Netflix Clone' })).toBeVisible()
  await visitor.close()
})

test('a watch party runs over a private Realtime channel that only its members can join', async ({ page, context }) => {
  await signInAsDemo(page, '/title/after-dark')
  await page.getByRole('button', { name: 'Watch party' }).click()
  await expect(page).toHaveURL(/\/party\/[0-9a-f]{10}$/)
  await expect(page.getByRole('heading', { name: 'Watching now (1)' })).toBeVisible()
  const invite = await page.getByLabel('Invite link').inputValue()

  // A second tab shares the saved session, so it joins as the same member over its own connection
  const guest = await context.newPage()
  await guest.goto(invite)
  for (const p of [page, guest]) await expect(p.getByRole('heading', { name: 'Watching now (2)' })).toBeVisible()
  await expect(page.getByLabel('Seek')).not.toHaveAttribute('max', '0')
  await page.locator('.player').getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => guest.locator('.player video').evaluate((v) => !v.paused)).toBe(true)
  await guest.getByLabel('Message').fill('Hello from tab two')
  await guest.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('list', { name: 'Party chat' })).toContainText('Hello from tab two')
  await guest.close()

  // A made-up code isn't a party
  await page.goto('/party/0000000000')
  await expect(page.getByText('This watch party has ended or doesn’t exist.')).toBeVisible()
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
