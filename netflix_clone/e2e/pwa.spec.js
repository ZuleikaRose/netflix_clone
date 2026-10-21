import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// The installable app: manifest, service worker (other specs block it so page.route() mocks see every request),
// starting offline, the offline notice and the install option in Account
test.use({ serviceWorkers: 'allow' })

test('the manifest describes an installable app with its icons', async ({ page, request }) => {
  await page.goto('/login')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const response = await request.get(href)
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await response.json()
  expect(manifest).toMatchObject({ name: 'Netflix Clone', start_url: '/', display: 'standalone' })
  expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable'])
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()['content-type']).toBe('image/png')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#090909')
})

test('once loaded, the app starts without a connection', async ({ page, context }) => {
  await page.goto('/login')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The first load happened before the worker existed; the next one fills its caches
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('You’re offline.', { exact: false })).toHaveCount(0)
})

test('Account offers to install the app when the browser can', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/account')
  const app = page.locator('section', { has: page.getByRole('heading', { name: 'App', exact: true }) })
  await expect(app).toContainText('To install, use your browser’s menu')

  // Headless browsers never offer installing, so stand in for the browser's event
  await page.evaluate(() => {
    const offer = new Event('beforeinstallprompt')
    offer.prompt = async () => {}
    offer.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(offer)
  })
  await app.getByRole('button', { name: 'Install Netflix Clone' }).click()
  await expect(app).toContainText('Netflix Clone is installed on this device.')
})
