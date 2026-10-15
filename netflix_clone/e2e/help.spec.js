import { expect, test } from '@playwright/test'
import { navigateInApp, signInAsDemo } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
})

test('every footer link opens a working page', async ({ page }) => {
  const footer = page.getByRole('navigation', { name: 'Legal' })
  const labels = await footer.getByRole('link').allInnerTexts()
  expect(labels.length).toBeGreaterThanOrEqual(10)

  for (const label of labels) {
    await footer.getByRole('link', { name: label, exact: true }).click()
    await expect(page.locator('.page-header h1')).toHaveText(label)
  }
})

test('support chat answers from the FAQs and help search opens FAQ results', async ({ page }) => {
  await navigateInApp(page, '/info/support')
  await page.getByRole('button', { name: 'Start live chat' }).click()
  await page.getByLabel('Message').fill('how do I change my password')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('.bubble.agent').last()).toContainText('Account → Change password')

  await page.getByLabel('Search help articles').fill('promo')
  await page.getByLabel('Search help articles').press('Enter')
  await expect(page).toHaveURL(/\/info\/faqs\?q=promo$/)
  await page.getByText('How do I use a promo code?').click()
  await expect(page.getByText('enter your code and select Apply')).toBeVisible()
})

test('feedback and issue reports validate, then confirm', async ({ page }) => {
  await navigateInApp(page, '/info/feedback')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Please choose a rating.')).toBeVisible()
  await page.locator('label', { has: page.getByRole('radio', { name: 'Excellent' }) }).click()
  await page.getByLabel('Your feedback').fill('Love the dark design and quick search.')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('heading', { name: 'Thanks for the feedback!' })).toBeVisible()

  await navigateInApp(page, '/info/report-issue')
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByLabel('What went wrong?')).toBeFocused()
  await page.getByLabel('What went wrong?').fill('Video freezes after 10 minutes')
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByText(/Report NF-\d+ received/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your reports' })).toBeVisible()
})

test('promo codes discount the plan and plan-specific codes drop on plan change', async ({ page }) => {
  await navigateInApp(page, '/info/promotions')
  await page.getByLabel('Promo code').fill('BOGUS')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('alert')).toContainText('isn’t valid')

  await page.getByLabel('Promo code').fill('welcome50')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('.membership')).toContainText('$7.75')

  await navigateInApp(page, '/account')
  await page.getByText('Premium', { exact: true }).click()
  await navigateInApp(page, '/info/promotions')
  await page.locator('.promo-card', { hasText: 'FAMILY15' }).getByRole('button').click()
  await expect(page.locator('.membership')).toContainText('$19.54')

  await navigateInApp(page, '/account')
  await page.getByText('Basic', { exact: true }).click()
  await expect(page.getByText('FAMILY15 removed (Premium only)')).toBeVisible()
})

test('share falls back to showing the link when the clipboard is unavailable', async ({ page }) => {
  await navigateInApp(page, '/title/the-veil')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.getByText(/Copy this link: http.*\/title\/the-veil/)).toBeVisible()
})
