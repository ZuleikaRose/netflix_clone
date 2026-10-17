import { expect } from '@playwright/test'

// On the in-memory build (most specs) all app state is in memory, so a full page load signs the user out.
// Tests sign in once, then move around with client-side navigation like a real user would.

export async function signInAsDemo(page, path = '/') {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

export async function navigateInApp(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`))
}

export const tabBar = (page) => page.getByRole('navigation', { name: 'Main navigation' })
