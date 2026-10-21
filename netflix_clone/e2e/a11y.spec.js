import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Reduced motion disables the page fade-in, so contrast is measured on fully rendered pages
test.use({ reducedMotion: 'reduce' })

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const signedInRoutes = [
  '/', '/title/after-dark', '/title/after-dark?play=1', '/tmdb/movie/603', '/tmdb/person/6384', '/people/Mara%20Quinn', '/search', '/search?q=zzz', '/new', '/my-netflix', '/favorites', '/account', '/profiles', '/support-dashboard', '/notifications', '/history', '/lists', '/shared/0000000000000000',
  '/games', '/games/memory', '/games/trivia', '/games/timeline', '/games/cast', '/games/higher-lower', '/games/scramble', '/does/not/exist',
  ...['support', 'faqs', 'feedback', 'report-issue', 'promotions', 'tech-requirements', 'ai', 'affiliate', 'legal', 'terms', 'privacy', 'do-not-sell', 'accessibility'].map((s) => `/info/${s}`),
]

// The fixed tab bar overlaps whatever content happens to scroll beneath it, which axe's target-size rule
// reports for that scroll position. Content is audited with the bar hidden and the bar audited on its own;
// "never hidden behind the bars" is covered for keyboard users by the focus-not-obscured test below.
async function audit(page, label) {
  const setTabBarVisibility = (visibility) => page.evaluate((v) => {
    const bar = document.querySelector('.bottom-nav')
    if (bar) bar.style.visibility = v
  }, visibility)
  await setTabBarVisibility('hidden')
  let content
  try {
    content = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()
  } finally {
    // Restore the bar even if axe throws, so later checks in the same test see the real page
    await setTabBarVisibility('')
  }
  // Signed-out pages have no tab bar; axe throws if include() matches nothing, so only audit it when present
  const hasTabBar = (await page.locator('.bottom-nav').count()) > 0
  const bar = hasTabBar ? await new AxeBuilder({ page }).include('.bottom-nav').withTags(WCAG_AA).analyze() : { violations: [] }
  const violations = [...content.violations, ...bar.violations]
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`)
  expect.soft(summary, `${label} has WCAG AA violations`).toEqual([])
}

test('signed-out pages meet WCAG 2.2 AA', async ({ page }) => {
  // /reset-password without a token shows its "invalid link" state; /signup stays last for the error-state check below
  for (const path of ['/login', '/forgot-password', '/reset-password', '/signup']) {
    await page.goto(path)
    await audit(page, path)
  }
  await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
  await audit(page, 'accessibility menu (signed out)')
  await page.keyboard.press('Escape')
  // Error states are where contrast and labelling most often break
  await page.getByRole('button', { name: 'Start Watching' }).click()
  await audit(page, '/signup with errors')
})

// In groups, so each test stays well inside its time limit as pages are added (each is audited twice: content + tab bar)
const ROUTES_PER_TEST = 12
const routeGroups = Array.from({ length: Math.ceil(signedInRoutes.length / ROUTES_PER_TEST) },
  (_, i) => signedInRoutes.slice(i * ROUTES_PER_TEST, (i + 1) * ROUTES_PER_TEST))

for (const [i, routes] of routeGroups.entries()) {
  test(`every signed-in page meets WCAG 2.2 AA (${i + 1} of ${routeGroups.length})`, async ({ page }) => {
    test.setTimeout(90_000)
    await signInAsDemo(page)
    for (const route of routes) {
      await navigateInApp(page, route)
      await expect(page.locator('.page h1, .page-header h1').first()).toBeVisible()
      await audit(page, route)
    }
  })
}

test('interactive states meet WCAG 2.2 AA', async ({ page }) => {
  test.setTimeout(90_000)
  await signInAsDemo(page)

  await navigateInApp(page, '/info/support')
  await page.getByRole('button', { name: 'Start live chat' }).click()
  await page.getByLabel('Message').fill('promo')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('.bubble.agent')).toHaveCount(2)
  await audit(page, 'support chat')

  await navigateInApp(page, '/info/faqs')
  await page.locator('summary').first().click()
  await audit(page, 'FAQ expanded')

  await navigateInApp(page, '/info/promotions')
  await page.getByLabel('Promo code').fill('BOGUS')
  await page.getByRole('button', { name: 'Apply' }).click()
  await audit(page, 'promo error')

  await navigateInApp(page, '/games/trivia')
  await page.locator('.answer').first().click()
  await audit(page, 'trivia answered')

  await navigateInApp(page, '/account')
  await page.getByRole('button', { name: 'Update payment method' }).click()
  await page.getByRole('button', { name: 'Save card' }).click()
  await page.getByRole('button', { name: 'Cancel membership' }).click()
  await audit(page, 'billing errors + cancel confirmation')

  await navigateInApp(page, '/info/affiliate')
  await page.getByRole('button', { name: 'Apply now' }).click()
  await audit(page, 'affiliate form errors')
  await page.getByLabel('Website or channel URL').fill('https://example.com')
  await page.getByLabel('Newsletter').check()
  await page.getByLabel(/I agree to the program terms/).check()
  await page.getByRole('button', { name: 'Apply now' }).click()
  await audit(page, 'affiliate dashboard')

  await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
  await page.getByRole('button', { name: /Low vision/ }).click()
  await audit(page, 'accessibility menu with a profile on')
  await page.getByRole('button', { name: 'Reset all settings' }).click()
  await page.keyboard.press('Escape')

  await navigateInApp(page, '/title/night-shift?play=1')
  await expect(page.getByLabel('Seek')).not.toHaveAttribute('max', '0')
  await page.getByRole('button', { name: 'Closed captions' }).click()
  await page.getByLabel('Seek').fill('5')
  await expect(page.locator('.captions')).toBeVisible()
  await audit(page, 'player with captions')
  await page.getByLabel('Seek').fill(await page.getByLabel('Seek').getAttribute('max'))
  await expect(page.getByRole('group', { name: 'Playback finished' })).toBeVisible()
  await audit(page, 'player end screen')

  await navigateInApp(page, '/account')
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.getByRole('button', { name: 'Delete my account access' }).click()
  await audit(page, 'delete account errors')
})

test('keyboard focus is never hidden behind the sticky header or tab bar (WCAG 2.4.11)', async ({ page }) => {
  await signInAsDemo(page)
  for (const route of ['/', '/title/after-dark', '/info/support', '/account']) {
    await navigateInApp(page, route)
    await expect(page.locator('.page h1, .page-header h1').first()).toBeVisible()
    await page.evaluate(() => document.activeElement?.blur())

    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      const obscuredElement = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body || el.closest('.bottom-nav, .page-header, .topbar')) return null
        const box = el.getBoundingClientRect()
        const overlaps = (bar) => {
          const b = bar?.getBoundingClientRect()
          return b && box.bottom > b.top + 1 && box.top < b.bottom - 1
        }
        const covered = overlaps(document.querySelector('.bottom-nav')) || overlaps(document.querySelector('.page-header'))
        return covered ? `${el.tagName} "${(el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30)}"` : null
      })
      expect.soft(obscuredElement, `${route}: focused element is under a sticky bar`).toBeNull()
    }
  }
})
