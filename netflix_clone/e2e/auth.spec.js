import { expect, test } from '@playwright/test'
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
    await page.getByLabel('Password', { exact: true }).fill('longenough1')
    await page.getByLabel('Confirm password').fill('longenough1')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('alert')).toContainText('already exists')

    await page.getByLabel('Email').fill('sam@example.com')
    await page.getByText('Premium', { exact: true }).click()
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('heading', { name: 'Continue Watching for Sam' })).toBeVisible()
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
