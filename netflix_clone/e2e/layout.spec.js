import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

const routes = [
  '/', '/title/behind-the-glass', '/tmdb/show/1399', '/search', '/new', '/my-netflix', '/watchlist', '/favorites', '/account', '/profiles', '/games', '/games/memory', '/games/trivia', '/games/timeline', '/games/cast', '/games/higher-lower', '/games/scramble',
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

const overflowingElements = () => {
  const width = document.documentElement.clientWidth
  return [...document.querySelectorAll('.page *')]
    .filter((el) => !el.closest('.rail') && el.getBoundingClientRect().right > width + 1)
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
  expect(order).toEqual(['Home', 'Accessibility menu', 'Search', 'My Netflix profile', 'TV Shows'])
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
  expect(outline).toBe('solid')
})
