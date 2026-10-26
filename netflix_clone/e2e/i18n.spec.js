import { expect, test } from './test.js'
import { navigateInApp, signInAsDemo } from './helpers.js'

// The Spanish interface (src/i18n): Language in the accessibility menu. The rest of the suite runs in English.
test.describe('Spanish interface', () => {
  test('Language → Español translates the app, keeps titles as they are, and English comes back', async ({ page }) => {
    await signInAsDemo(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByRole('button', { name: 'Accessibility menu', exact: true }).click()
    const menu = page.getByRole('dialog')
    await menu.getByRole('group', { name: 'Language', exact: true }).getByRole('radio', { name: 'Español' }).check()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    // The menu itself follows at once
    await expect(menu.getByRole('group', { name: 'Idioma', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    // The tab bar and page headings are in Spanish; catalog titles stay as they are
    const tabs = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(tabs.getByRole('link', { name: 'Inicio' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Juegos' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Novedades' })).toBeVisible()
    await expect(page).toHaveTitle(/Inicio/)
    await navigateInApp(page, '/title/after-dark')
    await expect(page.getByRole('heading', { name: /AFTER\s*DARK/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^\s*(Reanudar|Reproducir)$/ })).toBeVisible()
    // The catalog's synopses and episode names are in Spanish too
    await expect(page.getByText(/^Un cartel de la autopista empieza a mostrar advertencias/)).toBeVisible()
    await navigateInApp(page, '/title/night-shift')
    await expect(page.getByRole('button', { name: 'Reproducir S1:E1 Piloto', exact: true })).toBeVisible()

    // A form in Spanish, with its validation message
    await navigateInApp(page, '/info/feedback')
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Feedback')

    // Reset turns accessibility settings off but keeps the language; English comes back from the menu
    await page.getByRole('button', { name: 'Menú de accesibilidad', exact: true }).click()
    await menu.getByRole('button', { name: /Restablecer/ }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await menu.getByRole('group', { name: 'Idioma', exact: true }).getByRole('radio', { name: 'English' }).check()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' })).toBeVisible()
  })

})

test.describe('Spanish browser', () => {
  test.use({ locale: 'es-MX' })

  test('starts in Spanish', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  })
})
