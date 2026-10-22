import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'
import { SUPABASE_E2E_PORT, supabaseConfigured } from './ports.js'
import { mockTmdb } from './tmdbMock.js'

// /donate: one-time donations through the process-donation Edge Function and Stripe (data/donations.js)

test.describe('donations on the in-memory build', () => {
  test('signed-out visitors are sent to sign in', async ({ page }) => {
    await page.goto('/donate')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the round coffee button on every page opens the donation page', async ({ page }) => {
    await signInAsDemo(page)
    for (const route of ['/', '/games', '/account']) {
      await navigateInApp(page, route)
      await expect(page.getByRole('link', { name: 'Donate: buy us a coffee' })).toBeVisible()
    }
    await page.getByRole('link', { name: 'Donate: buy us a coffee' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Make a donation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Donate: buy us a coffee' })).toHaveAttribute('aria-current', 'page')
  })

  test('Account links to the page, which says donations aren’t available and never loads Stripe', async ({ page }) => {
    const stripeRequests = []
    page.on('request', (r) => /stripe\.(com|network)/.test(r.url()) && stripeRequests.push(r.url()))
    await signInAsDemo(page)
    await navigateInApp(page, '/account')
    await page.getByRole('link', { name: 'Make a donation' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Make a donation' })).toBeVisible()
    await expect(page).toHaveURL(/\/donate$/)
    await expect(page.getByText('Donations aren’t available in this version of the app.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Donate/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Your donations' })).toHaveCount(0)
    expect(stripeRequests).toEqual([])
  })
})

// Against the dev project (:4174) with Stripe in test mode. One demo sign-in shared by every step (Auth rate-limits
// sign-ins per IP), desktop only, skipped without .env.development.local as in CI.
test.describe('donations with Supabase and Stripe', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 })
  test.skip(!supabaseConfigured, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.development.local to run these')

  const functionUrl = '**/functions/v1/process-donation'
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
  let page

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Runs once, on the desktop project')
    page = await browser.newPage({ baseURL: `http://localhost:${SUPABASE_E2E_PORT}`, viewport: { width: 1280, height: 800 } })
    await mockTmdb(page)
    await signInAsDemo(page)
  })

  test.afterAll(async () => {
    await page?.close()
  })

  const card = () => page.frameLocator('.card-input iframe').first()
  async function fillCard(number) {
    const frame = card()
    await frame.locator('input[name="cardnumber"]').fill(number)
    await frame.locator('input[name="exp-date"]').fill('12 / 34')
    await frame.locator('input[name="cvc"]').fill('123')
    const postal = frame.locator('input[name="postal"]')
    if (await postal.isVisible()) await postal.fill('10001')
  }
  const donateButton = () => page.getByRole('button', { name: 'Donate $10.00' })
  // No Stripe codes or raw messages on the page
  const expectNoRawCodes = async () => {
    const text = await page.locator('.page').innerText()
    expect(text).not.toMatch(/card_declined|generic_decline|insufficient_funds|card_error|api_connection_error|invalid_request_error/)
  }

  test('the page shows the amounts and Stripe’s card field', async () => {
    await navigateInApp(page, '/donate')
    await expect(page.getByRole('heading', { level: 1, name: 'Make a donation' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Amount' }).getByRole('radio', { name: '$10' })).toBeChecked()
    await expect(page.locator('.card-input iframe[name^="__privateStripeFrame"]')).toHaveCount(1)
    // A new demo account has no donations yet
    await expect(page.getByRole('region', { name: 'Your donations' })).toContainText('You haven’t made a donation yet.')
    await expect(page.getByRole('group', { name: 'Card details' })).toBeVisible()

    // Validated on submit: the other amount, then the card
    await page.getByRole('radio', { name: 'Other amount' }).check()
    await page.getByRole('button', { name: 'Donate', exact: true }).click()
    await expect(page.locator('.field-error', { hasText: 'Enter an amount.' })).toBeVisible()
    await expect(page.getByLabel('Other amount (US dollars)')).toBeFocused()
    await page.getByLabel('Other amount (US dollars)').fill('0.5')
    await page.getByRole('button', { name: 'Donate', exact: true }).click()
    await expect(page.getByText('Choose an amount between $1.00 and $10,000.00.')).toBeVisible()
    await page.getByRole('radio', { name: '$10' }).check()
    await donateButton().click()
    await expect(page.getByText('Enter a valid card number.')).toBeVisible()
  })

  test('a network failure offers to try again', async () => {
    await fillCard('4242 4242 4242 4242')
    await page.route(functionUrl, (route) => route.abort('internetdisconnected'))
    await donateButton().click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Something went wrong. Please check your connection and try again.')
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
    await page.unroute(functionUrl)
  })

  test('the function’s own error message is shown, without codes', async () => {
    await page.route(functionUrl, (route) => (route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 503, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Donations are not available right now.' }) })))
    await donateButton().click()
    await expect(page.getByRole('alert')).toContainText('Donations are not available right now.')
    await expect(page.getByRole('heading', { name: 'Your donation didn’t go through' })).toBeFocused()
    await expectNoRawCodes()
    await page.unroute(functionUrl)
  })

  test('a confirmation that gets no answer is retried with the same PaymentIntent, not a new one', async () => {
    // A made-up intent: the function is mocked, and Stripe's confirm call fails with no response
    const intent = 'pi_3E2eDonationRetry0001'
    const clientSecret = `${intent}_secret_e2eRetry`
    let intentsCreated = 0
    await page.route(functionUrl, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      intentsCreated += 1
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ client_secret: clientSecret }) })
    })
    const confirmUrl = `https://api.stripe.com/v1/payment_intents/${intent}/confirm`
    const intentUrl = (url) => url.href.startsWith(`https://api.stripe.com/v1/payment_intents/${intent}?`)
    await page.route(confirmUrl, (route) => route.abort('internetdisconnected'))
    // Asked again, Stripe says the first confirmation went through after all
    await page.route(intentUrl, (route) => route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: intent, object: 'payment_intent', amount: 1000, currency: 'usd', status: 'succeeded', client_secret: clientSecret, livemode: false }),
    }))
    await donateButton().click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Something went wrong. Please check your connection and try again.', { timeout: 20_000 })
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for your $10.00 donation' })).toBeVisible()
    expect(intentsCreated).toBe(1)
    await page.unroute(functionUrl)
    await page.unroute(confirmUrl)
    await page.unroute(intentUrl)
    await page.getByRole('button', { name: 'Make another donation' }).click()
  })

  // Made-up PaymentIntents answered by mocks of the function and Stripe's API, for the retry rules below
  const stripeReply = (body, status = 200) => ({
    status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body),
  })
  const fakeIntent = (id, status, amount = 1000) => ({
    id, object: 'payment_intent', amount, currency: 'usd', status, client_secret: `${id}_secret_e2e`, livemode: false,
  })
  // Mocks process-donation (one intent per call, from `ids`) and Stripe's confirm and retrieve calls for those intents.
  // `confirmWith(id, n)` answers the nth confirmation of an intent (a route.fulfill options object, or 'abort');
  // `statusOf(id)` is what retrieving it says. Returns the amounts the function was asked for.
  // `url`: the function to stand in for (process-donation unless given); `bodies` collects what it was sent
  async function mockDonation({ ids, confirmWith, statusOf = () => 'requires_payment_method', url = functionUrl, bodies = [] }) {
    const requested = []
    const confirms = {}
    await page.route(url, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const id = ids[requested.length]
      bodies.push(route.request().postDataJSON())
      requested.push(route.request().postDataJSON().amount)
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ client_secret: `${id}_secret_e2e` }) })
    })
    await page.route(/https:\/\/api\.stripe\.com\/v1\/payment_intents\/pi_3E2e\w+/, (route) => {
      const [, id, action] = new URL(route.request().url()).pathname.match(/payment_intents\/(\w+?)(?:\/(confirm))?$/)
      if (!action) return route.fulfill(stripeReply(fakeIntent(id, statusOf(id))))
      confirms[id] = (confirms[id] ?? 0) + 1
      const answer = confirmWith(id, confirms[id])
      return answer === 'abort' ? route.abort('internetdisconnected') : route.fulfill(answer)
    })
    return requested
  }
  async function unmockDonation(url = functionUrl) {
    await page.unroute(url)
    await page.unroute(/https:\/\/api\.stripe\.com\/v1\/payment_intents\/pi_3E2e\w+/)
  }
  const declined = stripeReply({ error: { type: 'card_error', code: 'card_declined', decline_code: 'generic_decline', message: 'Your card was declined.' } }, 402)

  test('trying again after a declined card keeps the same PaymentIntent, so Your donations shows one donation', async () => {
    const requested = await mockDonation({
      ids: ['pi_3E2eDonationDecline01'],
      confirmWith: (id, n) => (n === 1 ? declined : stripeReply(fakeIntent(id, 'succeeded'))),
    })
    await fillCard('4242 4242 4242 4242')
    await donateButton().click()
    await expect(page.getByRole('alert')).toContainText('Your card was declined. Please try a different card.')
    await donateButton().click()
    await expect(page.getByRole('heading', { name: 'Thank you for your $10.00 donation' })).toBeVisible()
    expect(requested).toEqual([1000])
    await unmockDonation()
    await page.getByRole('button', { name: 'Make another donation' }).click()
  })

  test('a new amount after a confirmation that got no answer checks the first one before starting another', async () => {
    // The first $10.00 went through after all: that's the donation, and no $25.00 intent is created
    let requested = await mockDonation({ ids: ['pi_3E2eDonationAmount01'], confirmWith: () => 'abort', statusOf: () => 'succeeded' })
    await fillCard('4242 4242 4242 4242')
    await donateButton().click()
    await expect(page.getByRole('alert')).toContainText('Something went wrong. Please check your connection and try again.', { timeout: 20_000 })
    await page.getByRole('radio', { name: '$25' }).check()
    await page.getByRole('button', { name: 'Donate $25.00' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for your $10.00 donation' })).toBeVisible()
    expect(requested).toEqual([1000])
    await unmockDonation()
    await page.getByRole('button', { name: 'Make another donation' }).click()

    // The first one was never paid: the new amount gets its own intent
    requested = await mockDonation({
      ids: ['pi_3E2eDonationAmount02', 'pi_3E2eDonationAmount03'],
      confirmWith: (id) => (id === 'pi_3E2eDonationAmount02' ? 'abort' : stripeReply(fakeIntent(id, 'succeeded', 2500))),
    })
    await fillCard('4242 4242 4242 4242')
    await donateButton().click()
    await expect(page.getByRole('alert')).toContainText('Something went wrong. Please check your connection and try again.', { timeout: 20_000 })
    await page.getByRole('radio', { name: '$25' }).check()
    await page.getByRole('button', { name: 'Donate $25.00' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for your $25.00 donation' })).toBeVisible()
    expect(requested).toEqual([1000, 2500])
    await unmockDonation()
    await page.getByRole('button', { name: 'Make another donation' }).click()
  })

  test('a payment the bank is still processing says so, rather than that it didn’t go through', async () => {
    await mockDonation({ ids: ['pi_3E2eDonationPending01'], confirmWith: (id) => stripeReply(fakeIntent(id, 'processing')) })
    await fillCard('4242 4242 4242 4242')
    await donateButton().click()
    const heading = page.getByRole('heading', { name: 'Your $10.00 donation is being processed' })
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
    await expect(page.getByText('there’s no need to donate again')).toBeVisible()
    await expect(page.getByText('Your donation didn’t go through')).toHaveCount(0)
    await unmockDonation()
    await page.getByRole('button', { name: 'Make another donation' }).click()
  })

  test('Monthly starts a monthly donation through its own function', async () => {
    const monthlyUrl = '**/functions/v1/monthly-donation'
    const bodies = []
    await mockDonation({ ids: ['pi_3E2eDonationMonthly01'], url: monthlyUrl, bodies, confirmWith: (id) => stripeReply(fakeIntent(id, 'succeeded')) })
    const often = page.getByRole('group', { name: 'How often' })
    await expect(often.getByRole('radio', { name: 'One time' })).toBeChecked()
    await often.getByRole('radio', { name: 'Monthly' }).check()
    await expect(page.getByText('Charged today and on the same day each month until you cancel')).toBeVisible()
    await fillCard('4242 4242 4242 4242')
    await page.getByRole('button', { name: 'Donate $10.00 a month' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for giving $10.00 a month' })).toBeVisible()
    expect(bodies).toEqual([expect.objectContaining({ action: 'start', amount: 1000 })])
    await unmockDonation(monthlyUrl)
    await page.getByRole('button', { name: 'Make another donation' }).click()
    // Back to one time
    await expect(often.getByRole('radio', { name: 'One time' })).toBeChecked()
  })

  test('a test card donates $10.00, and a declined card says so in plain words', async () => {
    test.setTimeout(90_000)
    // The real function with Stripe in test mode. It answers 503 until it can read the Stripe API key on the dev project.
    await fillCard('4242 4242 4242 4242')
    const answered = page.waitForResponse((r) => r.url().includes('/functions/v1/process-donation') && r.request().method() === 'POST')
    await donateButton().click()
    const response = await answered
    if (response.status() === 503) {
      test.skip(true, 'The Stripe API key is not stored on the dev project yet')
    }
    expect(response.status(), `process-donation answered ${response.status()}: ${await response.text()}`).toBe(200)
    await expect(page.getByRole('heading', { name: 'Thank you for your $10.00 donation' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Thank you for your $10.00 donation' })).toBeFocused()
    // Demo accounts have made-up addresses, so no emailed receipt
    await expect(page.getByText('It will appear on your card statement.')).toBeVisible()
    // The webhook records it a moment later, and Your donations picks it up
    const history = page.getByRole('region', { name: 'Your donations' })
    await expect(history.getByRole('listitem').filter({ hasText: '$10.00' }).filter({ hasText: 'Paid' }).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Make another donation' }).click()

    await fillCard('4000 0000 0000 0002')
    await donateButton().click()
    await expect(page.getByRole('alert')).toContainText('Your card was declined. Please try a different card.', { timeout: 30_000 })
    await expectNoRawCodes()
  })

  test('a test card gives $10.00 a month until it’s cancelled', async () => {
    test.setTimeout(90_000)
    // The real monthly-donation function: a Stripe subscription in test mode, made active by the webhook
    await page.getByRole('group', { name: 'How often' }).getByRole('radio', { name: 'Monthly' }).check()
    await fillCard('4242 4242 4242 4242')
    const answered = page.waitForResponse((r) => r.url().includes('/functions/v1/monthly-donation') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Donate $10.00 a month' }).click()
    const response = await answered
    if (response.status() === 503) test.skip(true, 'The Stripe API key is not stored on the dev project yet')
    expect(response.status(), `monthly-donation answered ${response.status()}: ${await response.text()}`).toBe(200)
    await expect(page.getByRole('heading', { name: 'Thank you for giving $10.00 a month' })).toBeVisible({ timeout: 30_000 })

    // The webhook makes it active and records the first payment
    const monthly = page.getByRole('region', { name: 'Your monthly donation' })
    await expect(monthly).toContainText('You give $10.00 a month.', { timeout: 20_000 })
    await expect(monthly).toContainText('Demo accounts give once this way: it won’t renew next month.')
    const history = page.getByRole('region', { name: 'Your donations' })
    await expect(history.getByRole('listitem').filter({ hasText: 'Monthly' }).filter({ hasText: 'Paid' }).first()).toBeVisible({ timeout: 20_000 })
    // Only one at a time: the form offers one-time donations only
    await page.getByRole('button', { name: 'Make another donation' }).click()
    await expect(page.getByRole('group', { name: 'How often' })).toHaveCount(0)

    await monthly.getByRole('button', { name: 'Cancel monthly donation' }).click()
    await monthly.getByRole('button', { name: 'Keep it' }).click()
    await monthly.getByRole('button', { name: 'Cancel monthly donation' }).click()
    await monthly.getByRole('button', { name: 'Yes, stop it' }).click()
    await expect(monthly.getByRole('status')).toHaveText('Your monthly donation is cancelled. No more payments will be taken.')
    await expect(page.getByRole('group', { name: 'How often' })).toBeVisible()
  })
})
