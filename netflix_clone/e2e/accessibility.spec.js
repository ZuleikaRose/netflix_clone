import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo, tabBar } from './helpers.js'

// Accessibility menu, policy page, video player controls and captions, autoplay settings and account deletion

const html = (page) => page.locator('html')
const menu = (page) => page.getByRole('dialog', { name: 'Accessibility' })

test.describe('accessibility menu', () => {
  test('is available before signing in and closes with Escape', async ({ page }) => {
    await page.goto('/login')
    const launcher = page.getByRole('button', { name: 'Accessibility menu', exact: true })
    await launcher.click()
    await expect(menu(page)).toBeVisible()
    await expect(launcher).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(menu(page)).toBeHidden()
    await expect(launcher).toBeFocused()
  })

  test('settings apply to the page and Reset turns them off', async ({ page }) => {
    await signInAsDemo(page)
    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    await menu(page).getByRole('radio', { name: '150%' }).check()
    await menu(page).getByRole('radio', { name: 'Dyslexia-friendly' }).check()
    await menu(page).getByRole('switch', { name: /Highlight links/ }).check()
    await menu(page).getByRole('radio', { name: 'Monochrome' }).check()
    await expect(html(page)).toHaveAttribute('data-a11y-text-size', '150')
    await expect(html(page)).toHaveAttribute('data-a11y-font', 'dyslexia')
    await expect(html(page)).toHaveAttribute('data-a11y-highlight-links', 'true')
    expect(await html(page).evaluate((el) => el.style.filter)).toBe('grayscale(1)')

    await page.keyboard.press('Escape')
    // Bigger text still fits the phone width
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)

    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    await menu(page).getByRole('button', { name: 'Reset all settings' }).click()
    await expect(html(page)).not.toHaveAttribute('data-a11y-text-size')
    await expect(html(page)).not.toHaveAttribute('data-a11y-font')
    expect(await html(page).evaluate((el) => el.style.filter)).toBe('')
  })

  test('profiles turn a group of settings on and off', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    const profile = menu(page).getByRole('button', { name: /Seizure safe/ })
    await profile.click()
    await expect(profile).toHaveAttribute('aria-pressed', 'true')
    await expect(html(page)).toHaveAttribute('data-a11y-stop-animations', 'true')
    await expect(menu(page).getByRole('switch', { name: /Stop animations/ })).toBeChecked()
    await profile.click()
    await expect(profile).toHaveAttribute('aria-pressed', 'false')
    await expect(html(page)).not.toHaveAttribute('data-a11y-stop-animations')
  })

  test('reading guide follows the pointer', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    await menu(page).getByRole('switch', { name: /Reading guide/ }).check()
    await page.keyboard.press('Escape')
    await page.mouse.move(100, 300)
    await expect(page.locator('.reading-guide')).toHaveCSS('top', '300px')
  })
})

test('the Accessibility Policy is linked in the footer and the legal hub', async ({ page }) => {
  await signInAsDemo(page)
  await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Accessibility Policy' }).click()
  await expect(page.locator('.page-header h1')).toHaveText('Accessibility Policy')
  await expect(page.getByRole('heading', { name: 'Standard we follow' })).toBeVisible()
  await page.getByRole('link', { name: 'report an accessibility issue' }).click()
  await expect(page.getByLabel('Type of issue')).toHaveValue('Captions or accessibility')
  await navigateInApp(page, '/info/legal')
  await expect(page.locator('.topic-grid').getByRole('link', { name: /Accessibility Policy/ })).toBeVisible()
})

test.describe('video player', () => {
  const video = (page) => page.locator('.player video')
  const seek = (page) => page.getByLabel('Seek')

  // Start from the title page's Play button, like a viewer (browsers only allow playback with sound after a click)
  async function openPlayer(page, id) {
    await signInAsDemo(page)
    await navigateInApp(page, `/title/${id}`)
    await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
    await expect(seek(page)).not.toHaveAttribute('max', '0')
  }

  test('plays a real clip and the controls drive it', async ({ page }) => {
    await openPlayer(page, 'after-dark')
    const status = page.getByRole('status').filter({ hasText: 'After Dark' })
    await expect(status).toHaveText('Now playing · After Dark')
    await expect.poll(() => video(page).evaluate((v) => v.currentTime)).toBeGreaterThan(0.3)
    await expect(page.getByText(/Sample clip: Elephants Dream/)).toBeVisible()

    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(status).toHaveText('Paused · After Dark')
    expect(await video(page).evaluate((v) => v.paused)).toBe(true)

    await seek(page).fill('20')
    await expect(seek(page)).toHaveAttribute('aria-valuetext', '0:20 of 0:57')
    await page.getByRole('button', { name: 'Forward 10 seconds' }).click()
    await expect.poll(() => video(page).evaluate((v) => Math.round(v.currentTime))).toBe(30)
    await page.getByRole('button', { name: 'Back 10 seconds' }).click()
    await page.getByRole('button', { name: 'Back 10 seconds' }).click()
    await expect.poll(() => video(page).evaluate((v) => Math.round(v.currentTime))).toBe(10)

    await page.getByRole('button', { name: 'Mute' }).click()
    await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true')
    expect(await video(page).evaluate((v) => v.muted)).toBe(true)
    await expect(status).toContainText('Muted')
    await page.getByLabel('Playback speed').selectOption('1.5')
    await expect.poll(() => video(page).evaluate((v) => v.playbackRate)).toBe(1.5)
  })

  test('TV shows have previous and next episode buttons and Shift+P / Shift+N', async ({ page }) => {
    await openPlayer(page, 'night-shift')
    const status = page.getByRole('status').filter({ hasText: 'Night Shift' })
    const previous = page.getByRole('button', { name: 'Previous episode' })
    await expect(status).toContainText('Episode 1')
    await expect(previous).toHaveAttribute('aria-disabled', 'true')
    await previous.click({ force: true })
    await expect(status).toContainText('Episode 1')

    await page.getByRole('button', { name: 'Next episode' }).click()
    await expect(status).toContainText('Episode 2')
    await expect(previous).toHaveAttribute('aria-disabled', 'false')
    await page.keyboard.press('Shift+N')
    await expect(status).toContainText('Episode 3')
    await page.keyboard.press('Shift+P')
    await page.keyboard.press('Shift+P')
    await expect(status).toContainText('Episode 1')
    await expect.poll(() => video(page).evaluate((v) => v.currentTime)).toBeLessThan(5)
  })

  test('movies have no episode buttons', async ({ page }) => {
    await openPlayer(page, 'after-dark')
    await expect(page.getByRole('group', { name: 'Episodes' })).toHaveCount(0)
  })

  test('the volume is saved to the member, not just this browser', async ({ page }) => {
    await openPlayer(page, 'after-dark')
    await page.getByLabel('Volume').fill('35')
    // Saved a moment after the last change (or when the player closes)
    await page.getByRole('button', { name: 'Close player' }).click()
    await page.evaluate(() => localStorage.removeItem('netflix-clone-volume'))
    await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
    await expect(page.getByLabel('Volume')).toHaveValue('35')
  })

  test('the volume slider, arrow keys and Mute set the volume, which is remembered for the next video', async ({ page }) => {
    await openPlayer(page, 'after-dark')
    const volume = page.getByLabel('Volume')
    const mute = page.getByRole('button', { name: 'Mute' })
    const level = () => video(page).evaluate((v) => (v.muted ? 'muted' : v.volume))

    await expect(volume).toHaveAttribute('aria-valuetext', '100%')
    await volume.fill('40')
    await expect.poll(level).toBe(0.4)
    await expect(volume).toHaveAttribute('aria-valuetext', '40%')

    // Arrow keys change it by 10% while focus is in the player (not on a slider, which keeps its own keys)
    await page.getByRole('button', { name: 'Pause', exact: true }).focus()
    await page.keyboard.press('ArrowUp')
    await expect.poll(level).toBe(0.5)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect.poll(level).toBe(0.3)
    await expect(volume).toHaveValue('30')

    // 0 is muted, and unmuting from 0 comes back at 50%
    await volume.fill('0')
    await expect.poll(level).toBe('muted')
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(volume).toHaveAttribute('aria-valuetext', 'Muted')
    await mute.click()
    await expect.poll(level).toBe(0.5)
    await expect(mute).toHaveAttribute('aria-pressed', 'false')

    // Muting keeps the level, and the next video starts at it
    await mute.click()
    await expect(volume).toHaveValue('0')
    await mute.click()
    await expect(volume).toHaveValue('50')
    await page.getByRole('button', { name: 'Close player' }).click()
    await navigateInApp(page, '/title/the-signal')
    await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
    await expect(page.getByLabel('Volume')).toHaveValue('50')
    await expect.poll(level).toBe(0.5)
  })

  test('closed captions show the clip’s caption track and toggle from the player, the keyboard and the menu', async ({ page }) => {
    await openPlayer(page, 'behind-the-glass') // Sintel
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    const captions = page.locator('.captions')
    const cc = page.getByRole('button', { name: 'Closed captions' })
    await cc.click()
    await expect(cc).toHaveAttribute('aria-pressed', 'true')
    await seek(page).fill('3')
    await expect(captions).toHaveText('This blade has a dark past.')
    await seek(page).fill('14')
    await expect(captions).toHaveText('You\'re a fool for traveling alone,\nso completely unprepared.')

    // "C" toggles captions while focus is in the player
    await cc.focus()
    await page.keyboard.press('c')
    await expect(captions).toHaveCount(0)

    // The menu holds the same setting, plus caption size
    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    await menu(page).getByRole('switch', { name: /Closed captions/ }).check()
    await menu(page).getByRole('radio', { name: 'Extra large' }).check()
    await page.keyboard.press('Escape')
    await expect(captions).toHaveClass(/caption-xlarge/)
  })

  test('autoplay next episode counts down, and waits when turned off', async ({ page }) => {
    await openPlayer(page, 'night-shift')
    await seek(page).fill(await seek(page).getAttribute('max'))
    await expect(page.getByText(/Episode 2 starts in \ds/)).toBeVisible()
    await page.getByRole('button', { name: 'Play now' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Night Shift' })).toHaveText('Now playing · Night Shift · Episode 2')

    await navigateInApp(page, '/account')
    await page.getByRole('switch', { name: /Autoplay next episode/ }).uncheck()
    await navigateInApp(page, '/title/night-shift')
    await page.getByRole('button', { name: /^\s*(Resume|Play)$/ }).click()
    await expect(seek(page)).not.toHaveAttribute('max', '0')
    await seek(page).fill(await seek(page).getAttribute('max'))
    await expect(page.getByRole('button', { name: 'Play next episode' })).toBeVisible()
    await expect(page.getByText(/starts in/)).toHaveCount(0)
  })
})

test.describe('autoplay previews', () => {
  test('previews wait for a click until Autoplay previews is on', async ({ page }) => {
    await signInAsDemo(page)
    const hero = page.locator('.hero')
    await expect(hero.locator('.previewing')).toHaveCount(0)
    await page.getByRole('button', { name: /^Play preview of/ }).click()
    await expect(hero.locator('.previewing')).toHaveCount(1)
    await page.getByRole('button', { name: /^Pause preview of/ }).click()
    await expect(hero.locator('.previewing')).toHaveCount(0)

    await navigateInApp(page, '/account')
    await page.getByRole('switch', { name: /Autoplay previews/ }).check()
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(hero.locator('.previewing')).toHaveCount(1)
    await navigateInApp(page, '/title/cold-open')
    await expect(page.locator('.detail-art .previewing')).toHaveCount(1)
  })

  test('Stop animations overrides autoplay', async ({ page }) => {
    await signInAsDemo(page)
    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    await menu(page).getByRole('switch', { name: 'Autoplay previews' }).check()
    await expect(page.locator('.hero .previewing')).toHaveCount(1)
    await menu(page).getByRole('switch', { name: /Stop animations/ }).check()
    await page.keyboard.press('Escape')
    await expect(page.locator('.hero .previewing')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /preview of/ })).toHaveCount(0)
  })

  test('reduced motion never autoplays', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    await page.getByRole('switch', { name: /Autoplay previews/ }).check()
    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(page.locator('.hero .previewing')).toHaveCount(0)
  })
})

test.describe('delete account', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    await page.getByRole('button', { name: 'Delete account' }).click()
  })

  test('is blocked until the membership is cancelled and the email and password are entered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Before you delete your account' })).toBeFocused()
    await page.getByRole('button', { name: 'Delete my account access' }).click()
    await expect(page.getByRole('alert')).toContainText('Cancel it in Billing')
    await expect(page.getByLabel('Type your email address to confirm')).toBeFocused()
    await expect(page.getByText('This doesn’t match your account email.')).toBeVisible()
    await expect(page.getByText('Please enter your password.')).toBeVisible()

    await page.getByRole('button', { name: 'Go to Billing to cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Cancel membership' }).click()
    await page.getByRole('button', { name: 'Yes, cancel membership' }).click()
    await expect(page.getByText('Done: your membership is cancelled.')).toBeVisible()

    await page.getByLabel('Type your email address to confirm').fill('ALEX@example.com ')
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('wrong-password')
    await page.getByRole('button', { name: 'Delete my account access' }).click()
    await expect(page.getByText('Your password is incorrect.')).toBeVisible()
    await expect(password).toBeFocused()

    // The demo account's password changes on every load; Account shows it for this session
    await password.fill(await page.locator('.demo-credentials code').textContent())
    await page.getByRole('button', { name: 'Delete my account access' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status')).toHaveText(/Your account access has been deleted/)

    // The demo button recreates the demo account for this session
    await page.getByRole('button', { name: 'Use demo account' }).click()
    await expect(page).not.toHaveURL(/\/login$/)
  })

  test('links to a data removal ticket', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact support to submit a ticket' }).click()
    await expect(page.getByLabel('Type of issue')).toHaveValue('Data removal request')
  })

  test('Keep my account closes the form', async ({ page }) => {
    await page.getByRole('button', { name: 'Keep my account' }).click()
    await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible()
  })
})
