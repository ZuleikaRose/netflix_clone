import AxeBuilder from '@axe-core/playwright'
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

test('a downloaded title plays and seeks without a connection, and removing it frees the space', async ({ page, context }) => {
  test.setTimeout(60_000)
  await page.goto('/login')
  // Once the worker controls the page (it claims it after installing), downloads are offered
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true)
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page).not.toHaveURL(/\/login$/)

  await navigateInApp(page, '/title/behind-the-glass')
  await page.getByRole('button', { name: 'Download to watch offline' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Downloaded \(\d/ })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('link', { name: 'Downloads', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Downloads' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Behind the Glass' })).toContainText(/MB/)
  // The download controls only show with the worker, which the WCAG sweeps in a11y.spec.js block
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Behind the Glass' }).click()
  const video = page.locator('video')
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.3)
  // Seeking asks for a byte range, which the worker answers from the download
  await page.getByLabel('Seek').fill('30')
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(30)
  await context.setOffline(false)

  await navigateInApp(page, '/downloads')
  await page.getByRole('button', { name: 'Remove Behind the Glass download' }).click()
  await expect(page.getByText('No downloads yet.')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('downloads')).keys()).length)).toBe(0)
})

test('an older download gets the tracks it lacks, so Spanish captions work offline', async ({ page, context }) => {
  test.setTimeout(60_000)
  await page.goto('/login')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true)
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await navigateInApp(page, '/title/behind-the-glass') // Sintel
  await page.getByRole('button', { name: 'Download to watch offline' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Downloaded \(\d/ })).toBeVisible({ timeout: 20_000 })

  // A download from before the Spanish tracks existed
  const spanish = ['/media/sintel.es.vtt', '/media/sintel.es.descriptions.vtt']
  const cachedTracks = () => page.evaluate(async (urls) => {
    const cache = await caches.open('downloads')
    return (await Promise.all(urls.map((url) => cache.match(url)))).filter(Boolean).length
  }, spanish)
  await page.evaluate(async (urls) => {
    const cache = await caches.open('downloads')
    await Promise.all(urls.map((url) => cache.delete(url)))
  }, spanish)
  expect(await cachedTracks()).toBe(0)

  // Starting the app online fills them in
  await page.reload()
  await expect.poll(cachedTracks, { timeout: 15_000 }).toBe(2)

  // The reload signed the in-memory demo account out
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await context.setOffline(true)
  await navigateInApp(page, '/title/behind-the-glass')
  await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
  const menu = page.getByRole('dialog', { name: 'Accessibility' })
  await menu.getByRole('switch', { name: /Closed captions/ }).check()
  await menu.getByRole('group', { name: 'Caption language' }).getByRole('radio', { name: 'Español' }).check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByLabel('Seek').fill('3')
  await expect(page.locator('.captions')).toHaveText('Esta espada tiene un pasado oscuro.')
  await context.setOffline(false)
})
