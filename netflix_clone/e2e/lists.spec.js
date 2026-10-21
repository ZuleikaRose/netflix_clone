import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// Custom lists (in-memory accounts: lists and their share links last until a reload)

test('a list made from a title page can be renamed, shared by link, unshared and deleted', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/title/after-dark')
  await page.getByText('Add to a list').click()
  await page.getByLabel('New list name').fill('Friday frights')
  await page.getByRole('button', { name: 'Create list' }).click()
  await expect(page.getByRole('checkbox', { name: 'Friday frights' })).toBeChecked()
  await expect(page.locator('.add-to-list summary')).toContainText('in 1')

  // A second list can't reuse the name
  await page.getByLabel('New list name').fill('friday FRIGHTS')
  await page.getByRole('button', { name: 'Create list' }).click()
  await expect(page.getByText('You already have a list called friday FRIGHTS.')).toBeVisible()

  await navigateInApp(page, '/my-netflix')
  await page.getByRole('link', { name: 'My lists' }).click()
  await page.getByRole('link', { name: /Friday frights\s*1 title/ }).click()
  await expect(page.getByRole('heading', { name: 'Friday frights', level: 1 })).toBeVisible()
  await expect(page.locator('.list-grid').getByRole('link', { name: 'After Dark' })).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill('Late-night frights')
  await page.getByLabel('Description (optional)').fill('For when the lights are off.')
  await page.getByRole('button', { name: 'Save list' }).click()
  await expect(page.getByRole('heading', { name: 'Late-night frights', level: 1 })).toBeVisible()

  // Sharing: the link opens a public page with the list
  await page.getByRole('switch', { name: /Share with a link/ }).check()
  const link = await page.getByLabel('Share link').inputValue()
  expect(link).toMatch(/\/shared\/[0-9a-f]{16}$/)
  const path = new URL(link).pathname
  await navigateInApp(page, path)
  await expect(page.getByRole('heading', { name: 'Late-night frights', level: 1 })).toBeVisible()
  await expect(page.getByText('A list by Alex · 1 title')).toBeVisible()
  await expect(page.getByText('For when the lights are off.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'After Dark' })).toBeVisible()

  // Unshared: the link stops working
  await navigateInApp(page, '/lists')
  await page.getByRole('link', { name: /Late-night frights/ }).click()
  await page.getByRole('switch', { name: /Share with a link/ }).uncheck()
  await navigateInApp(page, path)
  await expect(page.getByRole('heading', { name: 'List not found', level: 1 })).toBeVisible()

  // Remove the title, then delete the list
  await navigateInApp(page, '/lists')
  await page.getByRole('link', { name: /Late-night frights/ }).click()
  await page.getByRole('button', { name: 'Remove After Dark from Late-night frights' }).click()
  await expect(page.getByText('Nothing here yet.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Delete this list…' }).click()
  await page.getByRole('group', { name: 'Delete Late-night frights' }).getByRole('button', { name: 'Delete list' }).click()
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByText('No lists yet.')).toBeVisible()
})

test('lists belong to the profile that made them', async ({ page }) => {
  await signInAsDemo(page)
  await navigateInApp(page, '/lists')
  await page.getByLabel('List name').fill('Alex picks')
  await page.getByRole('button', { name: 'Create list' }).click()
  await expect(page.getByRole('link', { name: /Alex picks/ })).toBeVisible()

  await navigateInApp(page, '/profiles')
  await page.getByRole('button', { name: 'Manage profiles' }).click()
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Profile name').fill('Sam')
  await page.locator('form').getByRole('button', { name: 'Add profile' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Sam', exact: true }).click()
  await navigateInApp(page, '/lists')
  await expect(page.getByText('No lists yet.')).toBeVisible()
})
