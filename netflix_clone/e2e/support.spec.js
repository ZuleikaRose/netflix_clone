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

test('the bell counts support replies until the notifications are opened', async ({ page }) => {
  await signInAsDemo(page)
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()
  await navigateInApp(page, '/info/report-issue')
  await page.getByLabel('What went wrong?').fill('Audio is out of sync')
  await page.getByRole('button', { name: 'Submit report' }).click()
  const number = (await page.locator('.form-success b').textContent()).trim()

  await navigateInApp(page, '/support-dashboard')
  await page.getByRole('button', { name: `Open ${number}` }).click()
  await page.getByLabel('Reply to Alex').fill('Fixed in today’s update.')
  await page.getByRole('button', { name: 'Send reply' }).click()

  await navigateInApp(page, '/')
  await page.getByRole('link', { name: 'Notifications (1 new)' }).click()
  await expect(page).toHaveURL(/\/notifications$/)
  const item = page.locator('.notification', { hasText: `Support replied to ${number}` })
  await expect(item).toHaveClass(/new/)
  await expect(item).toContainText('Fixed in today’s update.')
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()
  await item.getByRole('link').click()
  // Wait for the page itself, not just the URL: navigations are transitions, and coming straight back before this one
  // commits would leave the same Notifications page mounted (still showing this visit's markers)
  await expect(page.getByRole('heading', { name: 'Issue Reporting', level: 1 })).toBeVisible()

  // Seen: no count, and the reply is no longer marked new
  await navigateInApp(page, '/notifications')
  await expect(page.locator('.notification', { hasText: `Support replied to ${number}` })).not.toHaveClass(/new/)
})

test('a member reports a review; staff keep or remove it from the dashboard', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/title/behind-the-glass')
  const reviews = page.getByRole('region', { name: 'Ratings & Reviews' })
  // Your own reviews can't be reported
  await reviews.getByLabel('Write a review').fill('Loved the ending.')
  await reviews.getByRole('button', { name: 'Post review' }).click()
  await expect(reviews.getByRole('listitem').filter({ hasText: 'Loved the ending.' }).getByRole('button', { name: /Report/ })).toHaveCount(0)

  await reviews.getByRole('button', { name: 'Report Jordan’s review' }).click()
  const form = reviews.getByRole('form', { name: 'Report Jordan’s review' })
  await form.getByRole('button', { name: 'Send report' }).click()
  await expect(form.getByRole('alert')).toHaveText('Choose a reason.')
  await form.getByRole('radio', { name: 'Spoilers' }).check()
  await form.getByLabel('Anything else? (optional)').fill('Gives away the twist')
  await form.getByRole('button', { name: 'Send report' }).click()
  await expect(reviews.getByText('Reported. Our support team will take a look.')).toBeVisible()

  await navigateInApp(page, '/support-dashboard')
  await page.getByRole('button', { name: 'Reported reviews' }).click()
  const queue = page.getByRole('list', { name: 'Open reported reviews' })
  await expect(queue).toContainText('Every episode ends on a hook.')
  await expect(queue).toContainText('Spoilers · Alex')
  await expect(queue).toContainText('“Gives away the twist”')
  await queue.getByRole('button', { name: 'Remove review' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Jordan’s review removed' })).toBeVisible()
  await expect(page.getByText('No open reported reviews.')).toBeVisible()
  await page.getByRole('button', { name: 'Removed', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Removed reported reviews' })).toContainText('Every episode ends on a hook.')

  // The review is gone from the title page
  await navigateInApp(page, '/title/behind-the-glass')
  await expect(page.getByRole('heading', { name: 'Ratings & Reviews' })).toBeVisible()
  await expect(page.getByText('Every episode ends on a hook.')).toHaveCount(0)
})

test('staff see donations by month and filter the latest ones', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/support-dashboard')
  await page.getByRole('button', { name: 'Donations' }).click()
  // In memory, sample donations stand in: three this month (one didn't go through) and two last month
  const months = page.getByRole('table')
  await expect(months.getByRole('row')).toHaveCount(3)
  const thisMonth = months.getByRole('row').nth(1)
  await expect(thisMonth.getByRole('cell')).toHaveText(['$35.00', '2', '1'])

  const list = page.getByRole('list', { name: 'All donations' })
  await expect(list.getByRole('listitem')).toHaveCount(5)
  await page.getByRole('button', { name: 'Didn’t go through' }).click()
  const failed = page.getByRole('list', { name: 'Didn’t go through donations' })
  await expect(failed.getByRole('listitem')).toHaveCount(1)
  await expect(failed).toContainText('$5.00')
  await expect(failed).toContainText('Sam')
  // Sample donations have no Stripe payment to open
  await expect(failed.getByRole('link', { name: /Open in Stripe/ })).toHaveCount(0)
})
