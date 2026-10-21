import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { totpCode } from '../src/data/totp.js'

test.describe('authentication', () => {
  test('signed-out visitors are sent to sign in, then returned to where they were going', async ({ page }) => {
    await signInAsDemo(page, '/title/the-signal')
    await expect(page).toHaveURL(/\/title\/the-signal$/)
    await expect(page.getByRole('heading', { name: 'THE SIGNAL' })).toBeVisible()
    await expect(page).toHaveTitle('The Signal · Netflix Clone')
  })

  test('sign-in validates input and rejects wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeFocused()

    await page.getByLabel('Email').fill('alex@example.com')
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
  })

  test('sign up creates an account, rejects duplicates, and greets the user', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Name').fill('Sam')
    await page.getByLabel('Email').fill('ALEX@example.com')
    await page.getByLabel('Password', { exact: true }).fill('Long-enough-pw1')
    await page.getByLabel('Confirm password').fill('Long-enough-pw1')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('alert')).toContainText('already exists')

    await page.getByLabel('Email').fill('sam@example.com')
    await page.getByText('Premium', { exact: true }).click()
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByRole('heading', { name: 'Continue Watching for Sam' })).toBeVisible()
  })

  test('sign-up asks for the same strong passwords as Supabase Auth', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('At least 13 characters, with an uppercase and a lowercase letter, a number and a symbol.')).toBeVisible()
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('longenough1')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByText('Password needs at least 13 characters, an uppercase letter and a symbol.')).toBeVisible()
    await password.fill('ALLCAPS-AND-DIGITS-123')
    await page.getByRole('button', { name: 'Start Watching' }).click()
    await expect(page.getByText('Password needs a lowercase letter.')).toBeVisible()
  })

  test('forgot password: the reset link sets a new password once, then sign-in uses it', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot your password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.getByLabel('Email').fill('ALEX@example.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByRole('status')).toContainText('If there’s an account for alex@example.com')

    // Without a backend no email is sent; the page offers the link instead
    const resetLink = await page.getByRole('link', { name: 'Open the reset link' }).getAttribute('href')
    await page.getByRole('link', { name: 'Open the reset link' }).click()
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
    await expect(page.getByText('For alex@example.com.')).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/) // the one-time token is cleared from the address bar

    await page.getByLabel('New password', { exact: true }).fill('short')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText(/Password needs at least 13 characters/)).toBeVisible()
    await page.getByLabel('New password', { exact: true }).fill('Brand-new-pass-42')
    await page.getByLabel('Confirm new password').fill('Brand-new-pass-42')
    await page.getByRole('button', { name: 'Save new password' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status')).toHaveText('Your password has been changed. Sign in with your new password.')
    await page.getByLabel('Email').fill('alex@example.com')
    await page.getByLabel('Password', { exact: true }).fill('Brand-new-pass-42')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page).not.toHaveURL(/\/login$/)

    // Each link works once
    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    // Not navigateInApp: it expects the URL it navigated to, and the page strips the token from the address bar
    await page.evaluate((to) => {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, resetLink)
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole('alert')).toHaveText('This reset link is invalid or has expired. Please request a new one.')
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible()
  })

  test('sign out confirms, clears the session library, and refresh resets everything', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/title/after-dark')
    await page.getByRole('button', { name: 'My List' }).click()

    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await expect(page.getByText('See you soon, Alex.')).toBeVisible()

    await page.getByRole('link', { name: 'Sign In Again' }).click()
    await page.getByRole('button', { name: 'Use demo account' }).click()
    await navigateInApp(page, '/my-netflix')
    await expect(page.getByText('0 saved · 0 favorites · 0 rated')).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('two-step sign-in', () => {
  // The setup key the page shows, without its spaces; the test is the authenticator app
  const setupKey = async (page) => (await page.locator('.setup-key code').textContent()).replaceAll(' ', '')
  const security = (page) => page.getByRole('region', { name: 'Two-step sign-in' })

  test('turning it on asks for a code at the next sign-in, and turning it off needs a code', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    await security(page).getByRole('button', { name: 'Turn on two-step sign-in' }).click()
    const key = await setupKey(page)
    expect(key).toMatch(/^[A-Z2-7]{32}$/)
    const confirm = page.getByRole('form', { name: 'Confirm two-step sign-in' })
    await confirm.getByLabel('Six-digit code').fill('000000')
    await confirm.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByText('That code isn’t right.', { exact: false })).toBeVisible()
    await confirm.getByLabel('Six-digit code').fill(totpCode(key))
    await confirm.getByRole('button', { name: 'Turn on' }).click()
    await expect(security(page).getByRole('status')).toHaveText(/Two-step sign-in is on/)

    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.getByRole('link', { name: 'Sign In Again' }).click()
    await page.getByRole('button', { name: 'Use demo account' }).click()
    await expect(page.getByRole('heading', { name: 'Two-step sign-in' })).toBeVisible()
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Enter the six-digit code from your authenticator app.')).toBeVisible()
    await page.getByLabel('Six-digit code').fill(totpCode(key))
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()

    await navigateInApp(page, '/account')
    await security(page).getByRole('button', { name: 'Turn off two-step sign-in' }).click()
    const off = page.getByRole('form', { name: 'Turn off two-step sign-in' })
    await off.getByLabel('Six-digit code').fill(totpCode(key))
    await off.getByRole('button', { name: 'Turn off' }).click()
    await expect(security(page).getByRole('status')).toHaveText(/Two-step sign-in is off/)
  })

  test('the second step can be abandoned for another account', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    await security(page).getByRole('button', { name: 'Turn on two-step sign-in' }).click()
    const key = await setupKey(page)
    await page.getByLabel('Six-digit code').fill(totpCode(key))
    await page.getByRole('button', { name: 'Turn on' }).click()
    await expect(security(page).getByRole('status')).toHaveText(/Two-step sign-in is on/)

    await navigateInApp(page, '/logout')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.getByRole('link', { name: 'Sign In Again' }).click()
    await page.getByRole('button', { name: 'Use demo account' }).click()
    await page.getByRole('button', { name: 'Use another account' }).click()
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('Account lists the signed-in devices', async ({ page }) => {
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    const devices = page.getByRole('region', { name: 'Signed-in devices' })
    await expect(devices.getByText('This device')).toBeVisible()
    await expect(devices.getByText(/^Chrome on /)).toBeVisible()
    await expect(devices.getByText('No other devices are signed in.')).toBeVisible()
  })
})
