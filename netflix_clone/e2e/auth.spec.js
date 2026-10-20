import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

test.describe('authentication', () => {
  test('signed-out visitors are sent to sign in, then returned to where they were going', async ({ page }) => {
    await signInAsDemo(page, '/title/the-signal')
    await expect(page).toHaveURL(/\/title\/the-signal$/)
    await expect(page.getByRole('heading', { name: 'THE SIGNAL' })).toBeVisible()
    await expect(page).toHaveTitle('The Signal · Netflix Clone')
  })

  test('sign-in validates input and rejects wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeFocused()

    await page.getByLabel('Email').fill('alex@example.com')
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
  })

  test('sign up creates an account, rejects duplicates, and greets the user', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Name').fill('Sam')
    await page.getByLabel('Email').fill('ALEX@example.com')
    await page.getByLabel('Password', { exact: true }).fill('Long-enough-pw1')
    await page.getByLabel('Confirm password').fill('Long-enough-pw1')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('alert')).toContainText('already exists')

    await page.getByLabel('Email').fill('sam@example.com')
    await page.getByText('Premium', { exact: true }).click()
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('heading', { name: 'Continue Watching for Sam' })).toBeVisible()
  })

  test('sign-up asks for the same strong passwords as Supabase Auth', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('At least 13 characters, with an uppercase and a lowercase letter, a number and a symbol.')).toBeVisible()
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('longenough1')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByText('Password needs at least 13 characters, an uppercase letter and a symbol.')).toBeVisible()
    await password.fill('ALLCAPS-AND-DIGITS-123')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByText('Password needs a lowercase letter.')).toBeVisible()
  })

  test('forgot password: the reset link sets a new password once, then sign-in uses it', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot your password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.getByLabel('Email').fill('ALEX@example.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByRole('status')).toContainText('If there’s an account for alex@example.com')

    // Without a backend no email is sent; the page offers the link instead
    const resetLink = await page.getByRole('link', { name: 'Open the reset link' }).getAttribute('href')
    await page.getByRole('link', { name: 'Open the reset link' }).click()
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
    await expect(page.getByText('For alex@example.com.')).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/) // the one-time token is cleared from the address bar

    await page.getByLabel('New password', { exact: true }).fill('short')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText(/Password needs at least 13 characters/)).toBeVisible()
    await page.getByLabel('New password', { exact: true }).fill('Brand-new-pass-42')
    await page.getByLabel('Confirm new password').fill('Brand-new-pass-42')
    await page.getByRole('button', { name: 'Save new password' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status')).toHaveText('Your password has been changed. Sign in with your new password.')
    await page.getByLabel('Email').fill('alex@example.com')
    await page.getByLabel('Password', { exact: true }).fill('Brand-new-pass-42')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page).not.toHaveURL(/\/login$/)

    // Each link works once
    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    // Not navigateInApp: it expects the URL it navigated to, and the page strips the token from the address bar
    await page.evaluate((to) => {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, resetLink)
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole('alert')).toHaveText('This reset link is invalid or has expired. Please request a new one.')
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible()
  })

  test('sign out confirms, clears the session library, and refresh resets everything', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/title/after-dark')
    await page.getByRole('button', { name: 'My List' }).click()

    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await expect(page.getByText('See you soon, Alex.')).toBeVisible()

    await page.getByRole('link', { name: 'Sign In Again' }).click()
    await page.getByRole('button', { name: 'Use demo account' }).click()
    await navigateInApp(page, '/my-netflix')
    await expect(page.getByText('0 saved · 0 favorites · 0 rated')).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
  })
})
