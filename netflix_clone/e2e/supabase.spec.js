import { expect, test } from '@playwright/test'
import { loadEnv } from 'vite'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Same variables `vite build` bakes in. CI has no .env.local, so the app (and these checks) run on the built-in catalog.
const env = loadEnv('production', process.cwd(), 'VITE_')
const configured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY)
const titlesEndpoint = '**/rest/v1/titles*'

test.describe('catalog from the Supabase REST API', () => {
  test.skip(!configured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local to run these')

  test('the app loads titles from /rest/v1/titles', async ({ page }) => {
    const response = page.waitForResponse((r) => r.url().includes('/rest/v1/titles'))
    await signInAsDemo(page)
    const titles = await (await response).json()
    expect((await response).status()).toBe(200)
    expect(titles.length).toBeGreaterThanOrEqual(9)
    expect(titles.find((t) => t.id === 'after-dark')).toMatchObject({ title: 'After Dark', top10_rank: 1 })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/BEHIND\s*THE GLASS/)
  })

  test('pages show what the API returns', async ({ page }) => {
    await page.route(titlesEndpoint, async (route) => {
      const response = await route.fetch()
      const rows = await response.json()
      rows.find((t) => t.id === 'after-dark').title = 'After Dark (from Supabase)'
      await route.fulfill({ response, json: rows })
    })
    await signInAsDemo(page)
    await navigateInApp(page, '/title/after-dark')
    await expect(page.getByRole('heading', { name: 'After Dark (from Supabase)' }).first()).toBeVisible()
  })
})

test('the built-in catalog is used when the API is unreachable', async ({ page }) => {
  await page.route(titlesEndpoint, (route) => route.abort('internetdisconnected'))
  await signInAsDemo(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/BEHIND\s*THE GLASS/)
  await navigateInApp(page, '/title/after-dark')
  await expect(page.getByRole('heading', { name: 'After Dark' }).first()).toBeVisible()
})
