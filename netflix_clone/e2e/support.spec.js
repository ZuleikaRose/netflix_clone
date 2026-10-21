import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// The support dashboard. In memory the demo account is also the support team, so it answers its own reports.

test('staff answer a report and change its status; the member sees the reply and can answer', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/info/report-issue')
  await page.getByLabel('What went wrong?').fill('Captions drift on Night Shift')
  await page.getByRole('button', { name: 'Submit report' }).click()
  const number = (await page.locator('.form-success b').textContent()).trim()

  await navigateInApp(page, '/account')
  await page.getByRole('link', { name: 'Support dashboard' }).click()
  await expect(page).toHaveURL(/\/support-dashboard$/)
  const queue = page.getByRole('list', { name: 'Open tickets' })
  await expect(queue).toContainText('Captions drift on Night Shift')
  await page.getByRole('button', { name: `Open ${number}` }).click()
  await expect(page.locator('.ticket-facts')).toContainText('alex@example.com')
  await page.getByLabel('Reply to Alex').fill('Thanks, we’re looking into it.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(page.getByRole('list', { name: `Replies on ${number}` })).toContainText('Support team')

  await page.getByLabel(`Status of ${number}`).selectOption('In progress')
  await expect(page.getByText('No open tickets.')).toBeVisible()
  await page.getByRole('button', { name: 'In progress', exact: true }).click()
  await expect(page.getByRole('list', { name: 'In progress tickets' })).toContainText(number)

  // The member's side
  await navigateInApp(page, '/info/report-issue')
  const report = page.locator('.ticket-list li', { hasText: number })
  await expect(report.locator('.ticket-status')).toHaveText('In progress')
  await expect(report).toContainText('Thanks, we’re looking into it.')
  await report.getByLabel(`Add to ${number}`).fill('It happens on episode 2 too.')
  await report.getByRole('button', { name: 'Send reply' }).click()
  await expect(report.getByRole('list', { name: `Replies on ${number}` }).locator('li')).toHaveCount(2)
})

test('members who aren’t staff don’t get the dashboard', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Robin')
  await page.getByLabel('Email').fill('robin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('Long-enough-pw1')
  await page.getByLabel('Confirm password').fill('Long-enough-pw1')
  await page.getByRole('button', { name: 'Start Watching' }).click()
  await expect(page.getByRole('heading', { name: 'Top 10 in the U.S. Today' })).toBeVisible()
  await navigateInApp(page, '/account')
  await expect(page.getByRole('link', { name: 'Support dashboard' })).toHaveCount(0)
  await navigateInApp(page, '/support-dashboard')
  await expect(page.getByRole('heading', { name: /not found|lost/i }).first()).toBeVisible()
})
