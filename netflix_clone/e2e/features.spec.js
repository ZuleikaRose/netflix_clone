import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo, tabBar } from './helpers.js'
import { catalog } from '../src/data/catalog.js'
import { pickSurprise } from '../src/data/surprise.js'

// Features added from the updated user journey (app_outline/user_journey.md)

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

test.describe('homepage', () => {
  // The catalog's own carousel (TMDB's is in tmdb.spec.js)
  test.use({ tmdb: 'fail' })

  test('featured carousel moves with arrows and dots', async ({ page }) => {
    const heroTitle = page.locator('.hero-title')
    await expect(heroTitle).toHaveText(/BEHIND\s*THE GLASS/)
    await page.getByRole('button', { name: 'Next featured title' }).click()
    await expect(heroTitle).toHaveText(/AFTER\s*DARK/)
    await expect(page.getByRole('button', { name: 'Show After Dark' })).toHaveAttribute('aria-current', 'true')
    await page.getByRole('button', { name: 'Previous featured title' }).click()
    await page.getByRole('button', { name: 'Previous featured title' }).click()
    await expect(heroTitle).toHaveText(/THE\s*VEIL/) // wraps around to the last (fifth) slide
  })

  test('service banner can be dismissed for the session', async ({ page }) => {
    const banner = page.getByRole('status', { name: 'Service notice' })
    await expect(banner).toContainText('Scheduled maintenance')
    await page.getByRole('button', { name: 'Dismiss notice' }).click()
    await expect(banner).toHaveCount(0)
    await navigateInApp(page, '/new')
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('status', { name: 'Service notice' })).toHaveCount(0)
  })

  test('turning off personalized recommendations hides the personalized row', async ({ page }) => {
    await navigateInApp(page, '/title/after-dark')
    await page.getByRole('button', { name: 'Favorite' }).click()
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('heading', { name: 'Because You Liked After Dark' })).toBeVisible()

    await navigateInApp(page, '/account')
    await page.getByRole('switch', { name: /Personalized recommendations/ }).uncheck()
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('heading', { name: /Because You Liked/ })).toHaveCount(0)
  })

  test('thumbs ratings: Love this! seeds Because You Liked and Not for me hides a title from recommendations', async ({ page }) => {
    const row = (name) => page.locator('.row-section', { has: page.getByRole('heading', { name, exact: true }) })
    await navigateInApp(page, '/title/the-signal')
    await page.getByRole('heading', { name: 'THE SIGNAL' }).waitFor()
    const rating = page.getByRole('group', { name: 'Rate The Signal' })
    await rating.getByRole('button', { name: 'Love this!' }).click()
    await expect(rating.getByRole('button', { name: 'Love this!' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.poster-link', { hasText: 'AFTER DARK' })).toHaveCount(1)

    await navigateInApp(page, '/title/after-dark')
    await page.getByRole('heading', { name: 'AFTER DARK' }).waitFor()
    await page.getByRole('button', { name: 'Not for me' }).click()
    await expect(page.getByText('We won’t recommend After Dark to this profile.')).toBeVisible()

    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    const liked = row('Because You Liked The Signal')
    await expect(liked).toBeVisible()
    await expect(liked.getByRole('link', { name: 'Behind the Glass' })).toBeVisible()
    await expect(liked.getByRole('link', { name: 'After Dark' })).toHaveCount(0)

    // Choosing it again takes the rating back
    await navigateInApp(page, '/title/after-dark')
    await page.getByRole('button', { name: 'Not for me' }).click()
    await expect(page.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'false')
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(row('Because You Liked The Signal').getByRole('link', { name: 'After Dark' })).toBeVisible()
  })

  test('row arrows page through a row and stop at its ends', async ({ page }) => {
    const left = page.getByRole('button', { name: 'Scroll Top 10 in the U.S. Today left' })
    const right = page.getByRole('button', { name: 'Scroll Top 10 in the U.S. Today right' })
    const rail = page.locator('.row-section', { has: page.getByRole('heading', { name: 'Top 10 in the U.S. Today' }) }).locator('.rail')
    const scrollLeft = () => rail.evaluate((el) => el.scrollLeft)

    await expect(left).toHaveAttribute('aria-disabled', 'true')
    await expect(right).toHaveAttribute('aria-disabled', 'false')
    await right.click()
    await expect.poll(scrollLeft).toBeGreaterThan(0)
    await expect(left).toHaveAttribute('aria-disabled', 'false')

    // Quick clicks add up, so the row reaches its end; the button there stays focused but does nothing. `force`
    // because Playwright won't click a button once it's aria-disabled, which can happen mid-loop.
    for (let i = 0; i < 6; i++) await right.click({ force: true })
    await expect(right).toHaveAttribute('aria-disabled', 'true')
    await expect(right).toBeFocused()
    await left.click()
    await expect(right).toHaveAttribute('aria-disabled', 'false')
  })
})

test.describe('what should I watch?', () => {
  test('suggests titles for a request in plain words, and never one marked Not for me', async ({ page }) => {
    await page.getByRole('link', { name: 'What should I watch?' }).click()
    await expect(page.getByRole('heading', { name: 'Tell us what you’re in the mood for' })).toBeVisible()
    await page.getByRole('button', { name: 'Suggest titles' }).click()
    await expect(page.getByText('Tell us a little about what you feel like watching.')).toBeVisible()

    // The in-memory build has no AI service, so the words matcher answers (and says so)
    await page.getByRole('group', { name: 'Example requests' }).getByRole('button', { name: 'Something tense under two hours' }).click()
    const results = page.getByRole('region', { name: 'For “Something tense under two hours”' })
    await expect(results.getByRole('link', { name: 'After Dark' })).toBeVisible()
    await expect(results).toContainText('Matches thriller, tense, 1h 52m long.')
    await expect(results.getByRole('link', { name: 'The Signal' })).toHaveCount(0)
    await expect(results).toContainText('Suggested by matching words, not AI.')

    await results.getByRole('link', { name: 'After Dark' }).click()
    await page.getByRole('heading', { name: 'AFTER DARK' }).waitFor()
    await page.getByRole('button', { name: 'Not for me' }).click()
    await navigateInApp(page, '/what-to-watch')
    await page.getByLabel('Your request').fill('Something tense under two hours')
    await page.getByRole('button', { name: 'Suggest titles' }).click()
    await expect(page.getByText('Nothing matched those words.', { exact: false })).toBeVisible()
  })
})

test('title pages list cast and crew, and each name opens that person’s page', async ({ page }) => {
  await navigateInApp(page, '/title/the-signal')
  await expect(page.getByText('Director: Dara Whitfield')).toBeVisible()
  await expect(page.getByText('Writer: Ben Osei')).toBeVisible()
  await page.getByRole('link', { name: 'Dara Whitfield' }).click()
  await expect(page).toHaveURL(/\/people\/Dara%20Whitfield$/)
  await expect(page.getByRole('heading', { name: 'Dara Whitfield', level: 1 })).toBeVisible()
  await expect(page.getByText('Director · 1 title on Netflix Clone')).toBeVisible()
  const titles = page.locator('.credit-grid li')
  await expect(titles).toHaveCount(1)
  await expect(titles.first()).toContainText('Director')
  await titles.first().getByRole('link').click()
  await expect(page).toHaveURL(/\/title\/the-signal$/)

  await navigateInApp(page, '/people/Nobody%20Here')
  await expect(page.getByRole('heading', { name: /not found|lost/i }).first()).toBeVisible()
})

test('search filters by release year', async ({ page }) => {
  await navigateInApp(page, '/search')
  await page.getByLabel('Released').selectOption('2026')
  await expect(page).toHaveURL(/year=2026/)
  await expect(page.getByRole('heading', { name: '4 results' })).toBeVisible()
  await page.getByLabel('Released').selectOption('earlier')
  await expect(page.getByRole('heading', { name: '2 results' })).toBeVisible()
  // The catalog's grid comes first; TMDB titles (with Supabase) follow in their own section
  await expect(page.locator('.poster-grid').first().locator('.poster-link')).toHaveText(['THE VEIL', 'DEAD RECKONING'])
})

test('watch list and favorites have their own pages', async ({ page }) => {
  await navigateInApp(page, '/watchlist')
  await expect(page.getByRole('tab', { name: 'Watch list' })).toHaveAttribute('aria-selected', 'true')
  await expect(tabBar(page).getByRole('link', { name: 'My App' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('tab', { name: 'Favorites' }).click()
  await expect(page).toHaveURL(/\/favorites$/)
  await expect(page.getByText('Tap the heart on any title to add a favorite.')).toBeVisible()
})

test.describe('account billing', () => {
  test.beforeEach(async ({ page }) => {
    await navigateInApp(page, '/account')
  })

  test('payment method validates and keeps only brand and last four', async ({ page }) => {
    await expect(page.getByText('Visa •••• 4242')).toBeVisible()
    await page.getByRole('button', { name: 'Update payment method' }).click()
    await page.getByLabel('Name on card').fill('Alex Doe')
    await page.getByLabel('Card number').fill('4242 4242 4242 4241')
    await page.getByLabel('Expiry (MM/YY)').fill('01/20')
    await page.getByLabel('Security code').fill('12')
    await page.getByRole('button', { name: 'Save card' }).click()
    await expect(page.getByText('Enter a valid card number.')).toBeVisible()
    await expect(page.getByText('This card has expired.')).toBeVisible()
    await expect(page.getByLabel('Card number')).toBeFocused()

    await page.getByLabel('Card number').fill('5555 5555 5555 4444')
    await page.getByLabel('Expiry (MM/YY)').fill('12/39')
    await page.getByLabel('Security code').fill('123')
    await page.getByRole('button', { name: 'Save card' }).click()
    await expect(page.getByText('Mastercard •••• 4444')).toBeVisible()
    await expect(page.getByText('Payment method updated')).toBeVisible()
    // The full number never stays in the page once saved
    expect(await page.content()).not.toContain('5555555555554444')
  })

  test('billing date, pause and cancel update the membership', async ({ page }) => {
    await page.getByLabel('Bill me on the').selectOption('20')
    await expect(page.getByText(/Billing date changed to the 20th\. Next payment/)).toBeVisible()

    await page.getByLabel('Pause for').selectOption('2')
    await page.getByRole('button', { name: 'Pause membership' }).click()
    await expect(page.locator('.billing-state')).toHaveText(/^Paused · resumes /)
    await expect(page.locator('.membership')).toContainText('Paused · resumes')
    await page.getByRole('button', { name: 'Resume now' }).click()
    await expect(page.locator('.billing-state')).toHaveText(/^Next payment /)

    await page.getByRole('button', { name: 'Cancel membership' }).click()
    await expect(page.getByRole('button', { name: 'Keep membership' })).toBeFocused()
    await page.getByRole('button', { name: 'Yes, cancel membership' }).click()
    await expect(page.locator('.billing-state')).toHaveText(/^Cancelled · you can watch until /)
    await page.getByRole('button', { name: 'Restart membership' }).click()
    await expect(page.locator('.billing-state')).toHaveText(/^Next payment /)
  })
})

test.describe('affiliate program', () => {
  test.beforeEach(async ({ page }) => {
    await navigateInApp(page, '/info/affiliate')
  })

  test('joining validates the application, then shows a working dashboard', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Copy social caption/ }).first()).toBeDisabled()
    await page.getByLabel('Website or channel URL').fill('not a url')
    await page.getByRole('button', { name: 'Apply now' }).click()
    await expect(page.getByText(/Enter the full address/)).toBeVisible()
    await expect(page.getByText('Choose at least one way you’ll promote us.')).toBeVisible()
    await expect(page.getByText('You need to accept the program terms to join.')).toBeVisible()

    await page.getByLabel('Website or channel URL').fill('https://youtube.com/@alexwatches')
    await page.getByLabel('YouTube').check()
    await page.getByLabel(/I agree to the program terms/).check()
    await page.getByRole('button', { name: 'Apply now' }).click()

    await expect(page.getByRole('heading', { name: 'Your affiliate dashboard' })).toBeVisible()
    await expect(page.getByLabel('Your referral link')).toHaveValue(/\/signup\?ref=ALEX\d{2}$/)

    for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Simulate a sign-up' }).click()
    await page.getByRole('button', { name: 'Simulate a click' }).click()
    const stats = page.locator('.stat-grid')
    await expect(stats).toContainText('Sign-ups11')
    await expect(stats).toContainText('Earnings$115') // 10 × $10 + 1 × $15
    await expect(page.getByText(/Pro tier · \$15 per sign-up/)).toBeVisible()
  })

  test('copy falls back to showing the text when the clipboard is unavailable', async ({ page }) => {
    await page.getByLabel('Website or channel URL').fill('https://example.com')
    await page.getByLabel('Blog or website').check()
    await page.getByLabel(/I agree to the program terms/).check()
    await page.getByRole('button', { name: 'Apply now' }).click()

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(page.getByText(/Couldn’t access the clipboard/)).toContainText('/signup?ref=')
  })

  test('commission tiers and program terms are listed', async ({ page }) => {
    await expect(page.getByRole('row', { name: /Partner 51\+ \$20/ })).toBeVisible()
    await page.locator('summary', { hasText: 'Promotion restrictions' }).click()
    await expect(page.getByText('No paid search ads that bid on our brand name.')).toBeVisible()
  })
})

test('referral links show a welcome on sign-up', async ({ page }) => {
  await navigateInApp(page, '/logout')
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await navigateInApp(page, '/signup?ref=ALEX26')
  await expect(page.getByText('You were invited by a friend (code ALEX26). Welcome!')).toBeVisible()
})

test('legal hub links to every legal document', async ({ page }) => {
  await navigateInApp(page, '/info/legal')
  await expect(page.getByRole('heading', { name: 'Streaming disclaimers' })).toBeVisible()
  await page.locator('.topic-grid').getByRole('link', { name: /Terms of Service/ }).click()
  await expect(page.locator('.page-header h1')).toHaveText('Terms of Service')
})

test.describe('continue watching', () => {
  const video = (page) => page.locator('.player video')
  const continueRow = (page) => page.locator('.row-section', { has: page.getByRole('heading', { name: /^Continue Watching for/ }) })

  test('the player saves where you stopped, Home lists it first and Resume goes back there', async ({ page }) => {
    await expect(continueRow(page).getByRole('link', { name: 'Resume Behind the Glass' })).toHaveCount(0)
    await navigateInApp(page, '/title/behind-the-glass')
    await expect(page.getByRole('button', { name: /^\s*Play$/ })).toBeVisible()
    await page.getByRole('button', { name: /^\s*Play$/ }).click()
    await expect(page.getByLabel('Seek')).not.toHaveAttribute('max', '0')
    await page.getByLabel('Seek').fill('12')
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByRole('button', { name: 'Close player' }).click()

    await expect(page.getByRole('button', { name: /^\s*Resume$/ })).toBeVisible()
    await navigateInApp(page, '/')
    const resumeLinks = continueRow(page).getByRole('link', { name: /^Resume / })
    await expect(resumeLinks.first()).toHaveAccessibleName('Resume Behind the Glass')

    await resumeLinks.first().click()
    await expect.poll(() => video(page).evaluate((v) => v.currentTime)).toBeGreaterThan(11)
    expect(await video(page).evaluate((v) => v.currentTime)).toBeLessThan(20)
  })

  test('finishing an episode moves the show on to the next one', async ({ page }) => {
    await navigateInApp(page, '/title/behind-the-glass')
    await page.getByRole('button', { name: /^\s*Play$/ }).click()
    const seek = page.getByLabel('Seek')
    await expect(seek).not.toHaveAttribute('max', '0')
    await seek.fill(await seek.getAttribute('max'))
    await expect(page.getByRole('group', { name: 'Playback finished' })).toBeVisible()
    await page.getByRole('button', { name: 'Close player' }).click()

    await navigateInApp(page, '/')
    const card = continueRow(page).locator('.poster', { has: page.getByRole('link', { name: 'Resume Behind the Glass' }) })
    await expect(card.locator('.episode-badge')).toHaveText('E2')
  })
})

test.describe('seasons and episodes', () => {
  test('a show lists its episodes by season, and playing one starts that episode', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/title/night-shift')
    const season1 = page.getByRole('list', { name: 'Night Shift, Season 1' })
    await expect(season1.locator('li')).toHaveCount(8)
    await expect(season1.locator('li').first()).toContainText('S1:E1 Pilot')

    await page.getByRole('combobox', { name: 'Season', exact: true }).selectOption('2')
    const season2 = page.getByRole('list', { name: 'Night Shift, Season 2' })
    await expect(season2.locator('li')).toHaveCount(6)
    const first = (await season2.locator('.episode-name').first().innerText()).trim()
    await season2.getByRole('button', { name: `Play ${first}` }).click()
    await expect(page).toHaveURL(/play=1&episode=9/)
    await expect(page.getByRole('status').filter({ hasText: 'Night Shift' })).toContainText(first)
  })

  test('the last episode ends the series instead of offering a next one', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/title/the-veil')
    const finale = page.getByRole('list', { name: 'The Veil, Season 1' }).locator('li').last()
    await finale.getByRole('button', { name: /^Play S1:E8/ }).click()
    await expect(page.getByRole('button', { name: 'Next episode' })).toHaveAttribute('aria-disabled', 'true')
    const seek = page.getByLabel('Seek')
    await expect(seek).not.toHaveAttribute('max', '0')
    await seek.fill(await seek.getAttribute('max'))
    await expect(page.getByText(/that’s the end of the series/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play next episode' })).toHaveCount(0)
    await expect(page.getByText(/starts in/)).toHaveCount(0)
  })
})

test.describe('viewing history and privacy', () => {
  const watchFirstEpisode = async (page) => {
    await navigateInApp(page, '/title/behind-the-glass')
    await page.getByRole('button', { name: /^\s*(Play|Resume)$/ }).click()
    const seek = page.getByLabel('Seek')
    await expect(seek).not.toHaveAttribute('max', '0')
    await seek.fill(await seek.getAttribute('max'))
    await expect(page.getByRole('group', { name: 'Playback finished' })).toBeVisible()
    await page.getByRole('button', { name: 'Close player' }).click()
  }

  test('Year in Review sums up the profile’s year and shares a summary', async ({ page }) => {
    await navigateInApp(page, '/year-in-review')
    await expect(page.getByText(/Nothing watched in \d{4} yet/)).toBeVisible()

    await watchFirstEpisode(page)
    await navigateInApp(page, '/history')
    await page.getByRole('link', { name: 'See your Year in Review' }).click()
    const year = new Date().getFullYear()
    await expect(page.getByRole('heading', { name: `Alex’s ${year}` })).toBeVisible()
    const numbers = page.getByRole('list', { name: `${year} in numbers` })
    await expect(numbers).toContainText('1title')
    await expect(numbers).toContainText('1episode')
    await expect(numbers).toContainText('1day watching')
    const highlights = page.getByRole('region', { name: 'Highlights' })
    await expect(highlights.getByRole('link', { name: 'Behind the Glass' })).toBeVisible()
    await expect(highlights).toContainText('Top genresMystery, Thriller')
    // Everyone in it was seen once: ties go alphabetically
    await expect(highlights.getByRole('link', { name: 'Lena Voss' })).toBeVisible()
    await expect(highlights).toContainText('1 day in a row')
    await expect(highlights).toContainText(new Date().toLocaleDateString('en-US', { month: 'long' }))

    await page.evaluate(() => { delete Navigator.prototype.share })
    await page.getByRole('button', { name: 'Share my year' }).click()
    await expect(highlights.getByRole('status')).toHaveText(new RegExp(`Summary copied|Copy this summary: My ${year} on Netflix Clone: 1 title, 1 episode`))
  })

  test('what a profile watches is listed by day, and entries can be hidden or all cleared', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/history')
    await expect(page.getByText('Nothing here yet.', { exact: false })).toBeVisible()

    await watchFirstEpisode(page)
    await navigateInApp(page, '/account')
    await page.getByRole('link', { name: 'Viewing activity and history settings' }).click()
    await expect(page).toHaveURL(/\/history$/)
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const day = page.locator('.history-day', { has: page.getByRole('heading', { name: today }) })
    await expect(day.getByRole('link', { name: 'Behind the Glass: S1:E1 Pilot' })).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download all (CSV)' }).click()
    expect((await download).suggestedFilename()).toBe('viewing-activity.csv')

    await page.getByRole('button', { name: 'Hide Behind the Glass: S1:E1 Pilot from history' }).click()
    await expect(page.getByText('Nothing here yet.', { exact: false })).toBeVisible()

    await watchFirstEpisode(page)
    await navigateInApp(page, '/history')
    await page.getByRole('button', { name: 'Hide all…' }).click()
    await page.getByRole('group', { name: 'Hide all history' }).getByRole('button', { name: 'Hide all' }).click()
    await expect(page.getByText('Nothing here yet.', { exact: false })).toBeVisible()
  })

  test('with history turned off nothing is recorded, and old history can be set to delete itself', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/history')
    await page.getByRole('switch', { name: /Keep viewing history/ }).uncheck()
    const retention = page.getByLabel('Delete old history automatically')
    await retention.selectOption('90')
    await expect(retention).toHaveValue('90')

    await watchFirstEpisode(page)
    await navigateInApp(page, '/history')
    await expect(page.getByText('Nothing here yet.', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Delete old history automatically')).toHaveValue('90')
  })
})

test.describe('surprise me', () => {
  test('picks a title the profile can watch, never one marked Not for me nor the same one twice', () => {
    const [a, b] = catalog
    const first = () => 0
    expect(pickSurprise([a, b], { [a.id]: 'dislike' }, { random: first })).toBe(b)
    expect(pickSurprise([a, b], {}, { previous: a.id, random: first })).toBe(b)
    expect(pickSurprise([a], {}, { previous: a.id })).toBe(a) // the only one left
    expect(pickSurprise([a], { [a.id]: 'dislike' })).toBeNull()
    expect(pickSurprise(catalog, {}, { type: 'movie', random: first }).type).toBe('movie')
  })

  test('Home and Search open a random title, following the Movies filter', async ({ page }) => {
    await page.getByRole('button', { name: 'Movies', exact: true }).click()
    await page.getByRole('button', { name: 'Surprise me' }).click()
    await expect(page).toHaveURL(/\/title\//)
    await expect(page.locator('.eyebrow')).toContainText('FILM')
    const firstPick = page.url()

    await navigateInApp(page, '/search?type=show')
    await page.getByRole('button', { name: 'Surprise me' }).click()
    await expect(page.locator('.eyebrow')).toContainText('SERIES')
    expect(page.url()).not.toBe(firstPick)
  })
})
