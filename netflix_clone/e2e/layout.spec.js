import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo, tabBar } from './helpers.js'

const routes = [
  '/', '/title/behind-the-glass', '/tmdb/show/1399', '/tmdb/person/6384', '/people/Mara%20Quinn', '/search', '/new', '/my-netflix', '/watchlist', '/favorites', '/account', '/profiles', '/support-dashboard', '/notifications', '/history', '/year-in-review', '/what-to-watch', '/donate', '/lists', '/downloads', '/party/0000000000', '/shared/0000000000000000', '/games', '/games/memory', '/games/trivia', '/games/timeline', '/games/cast', '/games/higher-lower', '/games/scramble',
  ...['support', 'faqs', 'feedback', 'report-issue', 'promotions', 'tech-requirements', 'ai', 'affiliate', 'legal', 'terms', 'privacy', 'do-not-sell', 'accessibility'].map((s) => `/info/${s}`),
]

// Style guide: >= 44px touch targets. Counts ::before hit-area extensions and wrapping <label>s; inline links in prose are exempt (WCAG 2.5.8).
const undersizedTargets = () => [...document.querySelectorAll('.page :is(a, button, input, select, textarea, summary)')]
  .filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).opacity !== '0' && !el.hidden)
  .filter((el) => !(el.tagName === 'A' && el.closest('p')))
  .map((el) => {
    const box = el.getBoundingClientRect()
    let [w, h] = [box.width, box.height]
    const hit = getComputedStyle(el, '::before')
    if (hit.content !== 'none' && hit.position === 'absolute') {
      w -= parseFloat(hit.left) + parseFloat(hit.right)
      h -= parseFloat(hit.top) + parseFloat(hit.bottom)
    }
    const label = el.closest('label')?.getBoundingClientRect()
    if (label) [w, h] = [Math.max(w, label.width), Math.max(h, label.height)]
    return { name: (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30), w: Math.round(w), h: Math.round(h) }
  })
  .filter(({ w, h }) => w < 44 || h < 44)

// Rows that scroll sideways (.rail, Home's .filters chips) are meant to reach past the edge
const overflowingElements = () => {
  const width = document.documentElement.clientWidth
  return [...document.querySelectorAll('.page *')]
    .filter((el) => !el.closest('.rail, .filters') && el.getBoundingClientRect().right > width + 1)
    .map((el) => el.className || el.tagName)
}

test('every page has a heading, fits the screen, and meets touch-target size', async ({ page }) => {
  const errors = []
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  page.on('pageerror', (err) => errors.push(err.message))

  await signInAsDemo(page)
  for (const route of routes) {
    await navigateInApp(page, route)
    await expect(page.locator('.page h1, .page-header h1').first(), route).toBeVisible()
    expect(await page.evaluate(overflowingElements), `${route} overflows horizontally`).toEqual([])
    expect(await page.evaluate(undersizedTargets), `${route} has touch targets under 44px`).toEqual([])
  }
  expect(errors).toEqual([])
})

test('keyboard focus is visible and follows a logical order on Home', async ({ page }) => {
  await signInAsDemo(page)
  await expect(page.getByRole('button', { name: 'TV Shows' })).toBeVisible()
  // Start from the top of the document, not the just-removed sign-in button
  await page.evaluate(() => document.activeElement?.blur())
  const order = []
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    order.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.innerText))
  }
  // Wide screens (the desktop project) have the tabs in the top bar, between the logo and the icons
  const wide = page.viewportSize().width >= 1024
  expect(order).toEqual(wide
    ? ['Home', 'Home', 'Games', 'New & Hot', 'My App']
    : ['Home', 'Accessibility menu', 'Search', 'Notifications', 'My App profile'])
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
  expect(outline).toBe('solid')
})

// Phones, tablets (portrait and sideways), Chromebooks and notebooks, desktop monitors: the app fills the screen,
// with the tab bar at the bottom below 1024px and a top bar from 1024px
const devices = [
  { name: 'small phone', width: 320, height: 640 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet sideways', width: 1024, height: 768 },
  { name: 'notebook / Chromebook', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
]
for (const device of devices) {
  test.describe(`${device.name} (${device.width}×${device.height})`, () => {
    test.use({ viewport: { width: device.width, height: device.height } })

    test('every page fits the screen, and the navigation suits it', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Sets its own window size; runs once')
      test.setTimeout(120_000)
      await signInAsDemo(page)
      const wide = device.width >= 1024
      const nav = tabBar(page)
      await expect(nav).toBeVisible()
      const box = await nav.boundingBox()
      if (wide) {
        expect(box.y, 'the tabs are in the top bar').toBeLessThan(80)
      } else {
        expect(Math.round(box.y + box.height), 'the tab bar sits at the bottom').toBe(device.height)
        expect(Math.round(box.width), 'the tab bar spans the screen').toBe(device.width)
      }
      for (const route of routes) {
        await navigateInApp(page, route)
        await expect(page.locator('.page h1, .page-header h1').first(), route).toBeVisible()
        expect(await page.evaluate(overflowingElements), `${route} overflows horizontally`).toEqual([])
        // The app uses the whole width, not a phone-sized column
        expect(Math.round((await page.locator('.phone').boundingBox()).width), route).toBe(device.width)
      }
    })
  })
}
