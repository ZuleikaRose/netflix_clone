import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { catalog } from '../src/data/catalog.js'

// The games use the catalog (the Supabase titles match the built-in ones), so tests can look up the right answers
const byTitle = new Map(catalog.map((t) => [t.title, t]))
const letters = (text) => [...text.toLowerCase().replace(/[^a-z0-9]/g, '')].sort().join('')

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

test('the games page lists all six games', async ({ page }) => {
  await navigateInApp(page, '/games')
  for (const name of ['Poster Match', 'Plot Twist', 'Timeline', 'Cast Call', 'Higher or Lower', 'Title Scramble']) {
    await expect(page.locator('.game-card', { hasText: name })).toBeVisible()
  }
})

test('Timeline: ordering the titles oldest first scores every round', async ({ page }) => {
  await navigateInApp(page, '/games/timeline')
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`Round ${round} of 3`)).toBeVisible()
    const items = page.locator('.timeline-item b')
    await expect(items).toHaveCount(4)
    // Selection sort with the Earlier buttons: bring the oldest remaining title up to each position
    for (let position = 0; position < 4; position++) {
      const names = await items.allTextContents()
      const rest = names.slice(position)
      const oldest = rest.reduce((a, b) => (byTitle.get(a).year <= byTitle.get(b).year ? a : b))
      for (let at = names.indexOf(oldest); at > position; at--) {
        await page.getByRole('button', { name: `Move ${oldest} earlier` }).click()
      }
    }
    await page.getByRole('button', { name: 'Check order' }).click()
    await expect(page.locator('.answer-feedback')).toHaveText('✓ Perfect order!')
    await expect(page.locator('.timeline-item.right')).toHaveCount(4)
    await page.getByRole('button', { name: round < 3 ? 'Next round' : 'See score' }).click()
  }
  await expect(page.getByRole('heading', { name: 'You put 3 of 3 timelines in order' })).toBeVisible()
  await navigateInApp(page, '/games')
  await expect(page.locator('.game-card', { hasText: 'Timeline' })).toContainText('Best: 3 of 3')
})

test('Timeline: a wrong order shows the right one and the first card can’t move earlier', async ({ page }) => {
  await navigateInApp(page, '/games/timeline')
  const first = (await page.locator('.timeline-item b').first().textContent())
  await expect(page.getByRole('button', { name: `Move ${first} earlier` })).toHaveAttribute('aria-disabled', 'true')
  // Newest first is always wrong (every year is different)
  for (let position = 0; position < 4; position++) {
    const current = await page.locator('.timeline-item b').allTextContents()
    const newest = current.slice(position).reduce((a, b) => (byTitle.get(a).year >= byTitle.get(b).year ? a : b))
    for (let at = current.indexOf(newest); at > position; at--) await page.getByRole('button', { name: `Move ${newest} earlier` }).click()
  }
  await page.getByRole('button', { name: 'Check order' }).click()
  await expect(page.locator('.answer-feedback')).toContainText('✗ Not quite. Oldest first:')
  await expect(page.getByText('Score: 0')).toBeVisible()
})

test('Cast Call: picking the title the actor stars in scores, a wrong pick doesn’t', async ({ page }) => {
  await navigateInApp(page, '/games/cast')
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`Round ${round} of 5`)).toBeVisible()
    const actor = (await page.locator('#cast-q').textContent()).match(/stars (.+)\?$/)[1]
    const answer = catalog.find((t) => t.cast.includes(actor)).title
    const options = await page.locator('.answer').allTextContents()
    // Right on odd rounds, wrong on even ones
    const pick = round % 2 ? answer : options.find((o) => o !== answer)
    await page.locator('.answer', { hasText: pick }).first().click()
    await expect(page.locator('.answer-feedback')).toHaveText(round % 2 ? /^✓ Correct!/ : /^✗/)
    await expect(page.locator('.answer').first()).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: round < 5 ? 'Next question' : 'See score' }).click()
  }
  await expect(page.getByRole('heading', { name: 'You scored 3 of 5' })).toBeVisible()
})

test('Higher or Lower: right guesses build a streak that’s saved when a guess is wrong', async ({ page }) => {
  await navigateInApp(page, '/games/higher-lower')
  const pair = async () => {
    const [current, next] = await page.locator('.hl-card b').allTextContents()
    return byTitle.get(next).popularity > byTitle.get(current).popularity
  }
  for (let streak = 1; streak <= 3; streak++) {
    await page.getByRole('button', { name: (await pair()) ? '▲ Higher' : '▼ Lower' }).click()
    await expect(page.locator('.answer-feedback')).toHaveText(/^✓ Right!/)
    await expect(page.getByText(`Streak: ${streak}`)).toBeVisible()
    await page.getByRole('button', { name: 'Next title' }).click()
  }
  await page.getByRole('button', { name: (await pair()) ? '▼ Lower' : '▲ Higher' }).click()
  await expect(page.locator('.answer-feedback')).toHaveText(/^✗ Wrong\./)
  await expect(page.getByRole('heading', { name: 'Your streak: 3' })).toBeVisible()
  await navigateInApp(page, '/games')
  await expect(page.locator('.game-card', { hasText: 'Higher or Lower' })).toContainText('Best: 3 in a row')
})

test('Title Scramble: checks guesses, counts down, and scores less with a hint', async ({ page }) => {
  await navigateInApp(page, '/games/scramble')
  const answerFor = async () => {
    const scrambled = await page.locator('.scramble-letters').textContent()
    return catalog.find((t) => letters(t.title) === letters(scrambled)).title
  }
  const input = page.getByLabel('Your answer')

  // Round 1: an empty guess, a wrong one, then the right one with no hint (2 points)
  await page.getByRole('button', { name: 'Guess' }).click()
  await expect(page.getByText('Type the title you think it is.')).toBeVisible()
  await expect(input).toBeFocused()
  await input.fill('definitely not a title')
  await page.getByRole('button', { name: 'Guess' }).click()
  await expect(page.getByText('Not quite. 2 guesses left.')).toBeVisible()
  await input.fill((await answerFor()).toLowerCase())
  await page.getByRole('button', { name: 'Guess' }).click()
  await expect(page.locator('.answer-feedback')).toHaveText(/\+2$/)
  await page.getByRole('button', { name: 'Next title' }).click()

  // Round 2: with a hint (1 point)
  await page.getByRole('button', { name: 'Show a hint' }).click()
  await expect(page.locator('.scramble-hint')).toContainText(/A (series|film) from \d{4}/)
  await input.fill(await answerFor())
  await page.getByRole('button', { name: 'Guess' }).click()
  await expect(page.locator('.answer-feedback')).toHaveText(/\+1$/)
  await page.getByRole('button', { name: 'Next title' }).click()

  // Round 3: three wrong guesses reveal the answer
  const answer = await answerFor()
  for (let i = 0; i < 3; i++) {
    await input.fill('nope')
    await page.getByRole('button', { name: 'Guess' }).click()
  }
  await expect(page.locator('.answer-feedback')).toHaveText(`✗ Out of guesses. It was ${answer}.`)
  for (let round = 3; round <= 5; round++) {
    if (round > 3) {
      await input.fill(await answerFor())
      await page.getByRole('button', { name: 'Guess' }).click()
    }
    await page.getByRole('button', { name: round < 5 ? 'Next title' : 'See score' }).click()
  }
  await expect(page.getByRole('heading', { name: 'You scored 7 of 10' })).toBeVisible()
})

test('leaderboards show members who opt in, by first name', async ({ page }) => {
  await navigateInApp(page, '/games/trivia')
  const board = page.getByRole('region', { name: 'Leaderboard' })
  await expect(board.getByRole('listitem').first()).toContainText('Priya')
  const optIn = board.getByRole('switch', { name: /Show me on leaderboards/ })
  await expect(optIn).not.toBeChecked()

  for (let round = 1; round <= 5; round++) {
    await page.locator('.answer').first().click()
    await page.getByRole('button', { name: round < 5 ? 'Next question' : 'See score' }).click()
  }
  // A best score alone doesn't put anyone on the board
  await expect(board.getByText('(you)')).toHaveCount(0)
  await optIn.check()
  await expect(board.locator('li.me')).toContainText('Alex')

  // The same choice is in Account → Privacy & data
  await navigateInApp(page, '/account')
  await expect(page.getByRole('switch', { name: /Show me on game leaderboards/ })).toBeChecked()
})
