// Draws the app icons in public/icons/ from the favicon's design (red tile, white N):
//   node scripts/pwa-icons.mjs
// "any" icons keep the rounded tile; maskable ones fill the square and keep the N inside the 80% safe zone, since the
// device crops them to its own shape. The Apple touch icon has no transparency (iOS would fill it black).
import { chromium } from '@playwright/test'

const N = '<path d="M10.5 22.5v-13l11 13v-13" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
const tile = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#e50914"/>${N}</svg>`
// The N scaled to 70% about the centre, on a full red square
const fullBleed = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" fill="#e50914"/><g transform="translate(4.8 4.8) scale(.7)">${N}</g></svg>`

const icons = [
  ['icon-192.png', tile(192), true],
  ['icon-512.png', tile(512), true],
  ['maskable-512.png', fullBleed(512), false],
  ['apple-touch-icon.png', fullBleed(180), false],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, svg, transparent] of icons) {
  const size = Number(/width="(\d+)"/.exec(svg)[1])
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`)
  await page.locator('svg').screenshot({ path: `public/icons/${name}`, omitBackground: transparent })
  console.log(`public/icons/${name}`)
}
await browser.close()
