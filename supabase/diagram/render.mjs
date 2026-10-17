// Redraws ../../drawsql.png from erd.html with Playwright's Chromium (installed for the app's e2e tests).
// Run from the repo root after editing the tables or links in erd.html: node supabase/diagram/render.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))
const require = createRequire(here('../../netflix_clone/package.json'))
const { chromium } = require('@playwright/test')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1410, height: 1000 }, deviceScaleFactor: 1.62 })
  await page.goto('file://' + here('erd.html'))
  await page.waitForSelector('body[data-ready="1"]')
  const overlaps = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.t, #legend')].map((e) => [e.id, e.getBoundingClientRect()])
    const hits = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j]
      if (A.left < B.right && B.left < A.right && A.top < B.bottom + 20 && B.top < A.bottom + 20) hits.push(`${a} / ${b}`)
    }
    return hits
  })
  if (overlaps.length) console.warn('Tables too close, move them in erd.html:', overlaps.join(', '))
  await page.locator('#board').screenshot({ path: here('../../drawsql.png') })
  console.log('Wrote drawsql.png')
} catch (error) {
  // e.g. Chromium not installed (npx playwright install chromium) or drawsql.png not writable
  console.error('Couldn’t redraw drawsql.png:', error.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
