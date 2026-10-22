import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Profiles (in-memory accounts): each has its own name, avatar, maturity rating and library

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

// The in-memory demo password is new on every page load; Account shows it
async function demoPassword(page) {
  await navigateInApp(page, '/account')
  return page.locator('.demo-credentials code').textContent()
}

// Edit <name> → Profile lock → Add a PIN
async function lockProfile(page, name, pin, accountPassword) {
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await page.getByRole('button', { name: 'Add a PIN' }).click()
  const form = page.getByRole('form', { name: 'Set a PIN' })
  await form.getByLabel('New PIN').fill(pin)
  await form.getByLabel('Confirm PIN').fill(pin)
  await form.getByLabel('Account password').fill(accountPassword)
  await form.getByRole('button', { name: 'Save PIN' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} is locked with a PIN` })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
}

test('a profile can be locked with a PIN, which Who’s watching asks for', async ({ page }) => {
  const accountPassword = await demoPassword(page)
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  await page.getByRole('button', { name: 'Add a PIN' }).click()
  const form = page.getByRole('form', { name: 'Set a PIN' })
  await form.getByLabel('New PIN').fill('1234')
  await form.getByLabel('Confirm PIN').fill('1243')
  await form.getByLabel('Account password').fill(accountPassword)
  await form.getByRole('button', { name: 'Save PIN' }).click()
  await expect(page.getByText('PINs don’t match.')).toBeVisible()
  await form.getByLabel('Confirm PIN').fill('1234')
  await form.getByLabel('Account password').fill('not-the-right-one')
  await form.getByRole('button', { name: 'Save PIN' }).click()
  await expect(page.getByText('Your password is incorrect.')).toBeVisible()
  await form.getByLabel('Account password').fill(accountPassword)
  await form.getByRole('button', { name: 'Save PIN' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Alex is locked with a PIN' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  // Leaving the profile and coming back asks for the PIN
  await addProfile(page, { name: 'Guest' })
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Guest', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Alex (locked)' }).click()
  await page.getByLabel('Profile PIN').fill('9999')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('That PIN isn’t right. Please try again.')).toBeVisible()
  await page.getByLabel('Profile PIN').fill('1234')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
  await navigateInApp(page, '/my-netflix')
  await expect(page.locator('.profile-card h2')).toHaveText('Alex')
})

test('five wrong PINs lock the profile for 15 minutes', async ({ page }) => {
  const accountPassword = await demoPassword(page)
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await addProfile(page, { name: 'Guest' })
  await lockProfile(page, 'Alex', '2468', accountPassword)
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Guest', exact: true }).click()
  await navigateInApp(page, '/profiles')

  await page.getByRole('button', { name: 'Alex (locked)' }).click()
  for (let i = 0; i < 4; i++) {
    await page.getByLabel('Profile PIN').fill('0000')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('That PIN isn’t right. Please try again.')).toBeVisible()
  }
  await page.getByLabel('Profile PIN').fill('0000')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Too many wrong PINs. Try again in 15 minutes.')).toBeVisible()
  // Even the right PIN waits now
  await page.getByLabel('Profile PIN').fill('2468')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Too many wrong PINs. Try again in 15 minutes.')).toBeVisible()
})

test('a Kids profile asks a grown-up for the account password before Account and profile settings', async ({ page }) => {
  const accountPassword = await demoPassword(page)
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await addProfile(page, { name: 'Kids', maturity: 'kids' })
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Kids', exact: true }).click()
  await expect(page.locator('.hero-title')).toHaveText(/LANTERN\s*ISLAND/)

  await navigateInApp(page, '/account')
  await expect(page.getByRole('heading', { name: 'Ask a grown-up' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Membership', exact: true })).toHaveCount(0)
  await page.getByLabel('Account password').fill('a-guess')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('That password isn’t right.')).toBeVisible()
  await page.getByLabel('Account password').fill(accountPassword)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Membership', exact: true })).toBeVisible()

  // Leaving the Kids profile and coming back asks again
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Alex', exact: true }).click()
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Kids', exact: true }).click()
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  await expect(page.getByRole('heading', { name: 'Ask a grown-up' })).toBeVisible()
})

async function addProfile(page, { name, avatar, maturity }) {
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Profile name').fill(name)
  if (avatar) await page.getByText(avatar, { exact: true }).click()
  if (maturity) await page.getByLabel('Maturity rating').selectOption(maturity)
  await page.locator('form').getByRole('button', { name: 'Add profile' }).click()
}

test('an account with one profile goes straight in; My App shows the profile', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
  await navigateInApp(page, '/my-netflix')
  await expect(page.locator('.profile-card h2')).toHaveText('Alex')
  await page.getByRole('link', { name: 'Profiles', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Who’s watching?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alex', exact: true })).toBeVisible()
})

test('a Kids profile only sees kids’ titles, and each profile keeps its own lists', async ({ page }) => {
  // Alex saves a title
  await navigateInApp(page, '/title/after-dark')
  await page.getByRole('button', { name: 'My List' }).click()

  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await addProfile(page, { name: 'Kids', avatar: 'Green', maturity: 'kids' })
  await expect(page.getByRole('button', { name: 'Edit Kids' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Kids', exact: true }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.hero-title')).toHaveText(/LANTERN\s*ISLAND/)
  await expect(page.getByRole('heading', { name: /^Continue Watching/ })).toHaveCount(0)
  await navigateInApp(page, '/watchlist')
  await expect(page.locator('.profile-card h2')).toHaveText('Kids')
  await expect(page.getByText('Tap “My List” on any title to add it to your watch list.')).toBeVisible()

  // Back to Alex: the saved title is still there
  await page.getByRole('link', { name: 'Switch profile' }).click()
  await page.getByRole('button', { name: 'Alex', exact: true }).click()
  await navigateInApp(page, '/watchlist')
  await expect(page.getByRole('link', { name: 'After Dark', exact: true })).toBeVisible()
})

test('profile names must be unique, and an account has one to five profiles', async ({ page }) => {
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  // Only profile: it can't be deleted
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  await expect(page.getByRole('button', { name: 'Delete profile' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Profile name').fill('alex')
  await page.locator('form').getByRole('button', { name: 'Add profile' }).click()
  await expect(page.getByText('Another profile already has this name.')).toBeVisible()
  await expect(page.getByLabel('Profile name')).toBeFocused()
  await page.getByRole('button', { name: 'Cancel' }).click()

  for (const name of ['Sam', 'Jo', 'Riley', 'Max']) await addProfile(page, { name })
  await expect(page.locator('.profile-tile:not(.add)')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Add profile' })).toHaveCount(0)

  // Rename one, then delete it (two steps)
  await page.getByRole('button', { name: 'Edit Max' }).click()
  await page.getByLabel('Profile name').fill('Maxine')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.getByRole('button', { name: 'Edit Maxine' }).click()
  await page.getByRole('button', { name: 'Delete profile' }).click()
  await page.getByRole('button', { name: 'Yes, delete Maxine' }).click()
  await expect(page.getByRole('button', { name: 'Edit Maxine' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add profile' })).toBeVisible()
})

test('the maturity rating in Account belongs to the watching profile', async ({ page }) => {
  const accountPassword = await demoPassword(page)
  await expect(page.getByText('For Alex. Each profile has its own;')).toBeVisible()
  await page.getByLabel('Maturity rating').selectOption('kids')
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  // Alex is a Kids profile now, so its settings ask a grown-up first
  await page.getByLabel('Account password').fill(accountPassword)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByLabel('Maturity rating')).toHaveValue('kids')
})

test('a daily screen-time limit stops the player until a grown-up allows more time', async ({ page }) => {
  // The player counts watched time on a timer; a fake clock skips through the half hour
  await page.clock.install()
  const accountPassword = await demoPassword(page)
  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Edit Alex' }).click()
  const screenTime = page.getByRole('region', { name: 'Screen time' })
  await expect(screenTime).toContainText('Alex can watch as long as they like.')
  await screenTime.getByRole('combobox', { name: 'Daily limit' }).selectOption('30')
  await screenTime.getByLabel('Account password').fill('not-the-right-one')
  await screenTime.getByRole('button', { name: 'Save daily limit' }).click()
  await expect(screenTime.getByText('Your password is incorrect.')).toBeVisible()
  await screenTime.getByLabel('Account password').fill(accountPassword)
  await screenTime.getByRole('button', { name: 'Save daily limit' }).click()
  await expect(screenTime.getByRole('status')).toContainText('Alex can watch 30 minutes a day')
  await expect(screenTime).toContainText('Watched today: 0 minutes.')

  await navigateInApp(page, '/title/after-dark')
  await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
  const player = page.getByRole('region', { name: /Video player/ })
  await expect(player.getByRole('status').filter({ hasText: 'After Dark' })).toHaveText('Now playing · After Dark')
  await page.clock.runFor(31 * 60_000)
  const timeUp = page.getByRole('alertdialog', { name: 'Time’s up for today' })
  await expect(timeUp).toContainText('Alex has watched 30 minutes today')
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  expect(await page.locator('video').evaluate((v) => v.paused)).toBe(true)

  await timeUp.getByRole('button', { name: 'Ask a grown-up' }).click()
  await timeUp.getByLabel('Account password').fill('not-the-right-one')
  await timeUp.getByRole('button', { name: 'Allow 30 minutes' }).click()
  await expect(timeUp.getByText('That password isn’t right.')).toBeVisible()
  await timeUp.getByLabel('Account password').fill(accountPassword)
  await timeUp.getByRole('button', { name: 'Allow 30 minutes' }).click()
  await expect(timeUp).toHaveCount(0)
  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('status').filter({ hasText: 'After Dark' })).toHaveText('Now playing · After Dark')
})

test('Screen time sums up the last 7 days', async ({ page }) => {
  // A fixed afternoon, so "Today" and yesterday's label are known
  const monday = new Date(2026, 9, 19, 15, 0)
  await page.clock.install({ time: monday })
  const accountPassword = await demoPassword(page)
  const openScreenTime = async () => {
    await navigateInApp(page, '/profiles')
    await page.getByRole('button', { name: 'Manage profiles' }).click()
    await page.getByRole('button', { name: 'Edit Alex' }).click()
    return page.getByRole('region', { name: 'Screen time' })
  }
  let screenTime = await openScreenTime()
  // Without a limit nothing is counted, so there's no summary yet
  await expect(screenTime.getByRole('heading', { name: 'Last 7 days' })).toHaveCount(0)
  await screenTime.getByRole('combobox', { name: 'Daily limit' }).selectOption('30')
  await screenTime.getByLabel('Account password').fill(accountPassword)
  await screenTime.getByRole('button', { name: 'Save daily limit' }).click()
  await expect(screenTime.getByRole('heading', { name: 'Last 7 days' })).toBeVisible()
  await expect(screenTime).toContainText('Nothing watched yet.')

  await navigateInApp(page, '/title/after-dark')
  await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
  const player = page.getByRole('region', { name: /Video player/ })
  await expect(player.getByRole('status').filter({ hasText: 'After Dark' })).toHaveText('Now playing · After Dark')
  await page.clock.runFor(10 * 60_000)
  await player.getByRole('button', { name: 'Close player' }).click()

  screenTime = await openScreenTime()
  const days = screenTime.getByRole('list', { name: 'Time watched each day' }).getByRole('listitem')
  await expect(days).toHaveCount(7)
  await expect(days.first()).toHaveText(/Today\s*10 minutes/)
  await expect(screenTime).toContainText('10 minutes in total, about 1 minute a day.')

  // The next day: today starts from nothing, and Monday keeps its 10 minutes
  await page.clock.setSystemTime(new Date(2026, 9, 20, 9, 0))
  await navigateInApp(page, '/account')
  // The same region again: `days` finds the list inside it
  await openScreenTime()
  await expect(days.first()).toHaveText(/Today\s*None/)
  await expect(days.nth(1)).toHaveText(/Mon, Oct 19\s*10 minutes/)
})
