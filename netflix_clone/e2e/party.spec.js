import { expect, test } from './test.js'
import { signInAsDemo } from './helpers.js'
import { mockTmdb } from './tmdbMock.js'

// Watch parties on the in-memory build: two tabs of one browser, joined over a BroadcastChannel (with Supabase it's a
// private Realtime channel; supabase-auth.spec.js covers that)

const video = (page) => page.locator('.player video')
const playerButton = (page, name) => page.locator('.player').getByRole('button', { name, exact: true })

test('a watch party keeps members in step: play, seek, pause, chat, and who’s watching', async ({ page, context }) => {
  await signInAsDemo(page, '/title/after-dark')
  await page.getByRole('button', { name: 'Watch party' }).click()
  await expect(page).toHaveURL(/\/party\/[0-9a-f]{10}\?t=after-dark$/)
  const invite = new URL(await page.getByLabel('Invite link').inputValue())

  const guest = await context.newPage()
  await mockTmdb(guest)
  await signInAsDemo(guest, invite.pathname + invite.search)
  for (const p of [page, guest]) await expect(p.getByRole('heading', { name: 'Watching now (2)' })).toBeVisible()
  // It starts paused for everyone
  expect(await video(guest).evaluate((v) => v.paused)).toBe(true)

  // The host plays: the guest plays too
  await expect(page.getByLabel('Seek')).not.toHaveAttribute('max', '0')
  await playerButton(page, 'Play').click()
  await expect(guest.locator('.party-activity')).toHaveText(/^Alex played at 0:0\d$/)
  await expect.poll(() => video(guest).evaluate((v) => !v.paused)).toBe(true)

  // The guest skips ahead and pauses: the host follows
  await expect(guest.getByLabel('Seek')).not.toHaveAttribute('max', '0')
  await guest.getByLabel('Seek').fill('20')
  await expect.poll(() => video(page).evaluate((v) => v.currentTime)).toBeGreaterThan(19)
  await playerButton(guest, 'Pause').click()
  await expect(page.locator('.party-activity')).toHaveText(/^Alex paused at 0:2\d$/)
  await expect.poll(() => video(page).evaluate((v) => v.paused)).toBe(true)

  // Chat
  await guest.getByLabel('Message').fill('Popcorn ready?')
  await guest.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('list', { name: 'Party chat' })).toContainText('Popcorn ready?')

  // Leaving
  await guest.close()
  await expect(page.getByRole('heading', { name: 'Watching now (1)' })).toBeVisible()
})

test('a party link without its party says so', async ({ page }) => {
  await signInAsDemo(page, '/party/0000000000')
  await expect(page.getByText('This watch party has ended or doesn’t exist.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible()
})
