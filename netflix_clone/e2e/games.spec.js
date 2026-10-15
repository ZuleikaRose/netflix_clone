import { expect, test } from '@playwright/test'
import { navigateInApp, signInAsDemo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

test('Poster Match can be completed and records a best score', async ({ page }) => {
  await navigateInApp(page, '/games/memory')
  const cards = page.locator('.memory-card')
  await expect(cards).toHaveCount(12)

  // Learn the board two cards at a time (mismatches flip back after a short delay)
  const names = []
  for (let i = 0; i < 12; i += 2) {
    await cards.nth(i).click()
    await cards.nth(i + 1).click()
    names[i] = await cards.nth(i).getAttribute('aria-label')
    names[i + 1] = await cards.nth(i + 1).getAttribute('aria-label')
    await expect(page.locator('.memory-card.up:not(.matched)')).toHaveCount(0)
  }

  const positions = {}
  names.forEach((label, i) => (positions[label.replace(', matched', '')] ??= []).push(i))
  for (const [a, b] of Object.values(positions)) {
    if (await cards.nth(a).getAttribute('aria-disabled') === 'true') continue
    await cards.nth(a).click()
    await cards.nth(b).click()
  }

  await expect(page.getByRole('heading', { name: /All pairs found in \d+ moves!/ })).toBeVisible()
  await navigateInApp(page, '/games')
  await expect(page.locator('.game-card', { hasText: 'Poster Match' })).toContainText(/Best: \d+ moves/)
})

test('Plot Twist runs five rounds and locks each answer', async ({ page }) => {
  await navigateInApp(page, '/games/trivia')
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`Round ${round} of 5`)).toBeVisible()
    const answers = page.locator('.answer')
    await answers.first().click()
    await expect(page.locator('.answer-feedback')).toHaveText(/Correct|It was/)
    await expect(answers.first()).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: round < 5 ? 'Next question' : 'See score' }).click()
  }
  await expect(page.getByRole('heading', { name: /You scored \d of 5/ })).toBeVisible()
})
