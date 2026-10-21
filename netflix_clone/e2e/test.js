import { expect, test as base } from '@playwright/test'
import { mockTmdb } from './tmdbMock.js'

// Specs import `test` from here: every page starts with the tmdb Edge Function mocked (e2e/tmdbMock.js), and
// YouTube's trailer player answered with an empty page, so no test loads anything from YouTube
// `test.use({ tmdb: 'fail' })` makes every TMDB call fail instead, for specs about the catalog's own Home (the
// carousel and Top 10 fall back to it without TMDB, as in CI, which has no Supabase)
export const test = base.extend({
  tmdb: ['answer', { option: true }],
  // (Playwright's fixture callback is usually called `use`; renamed so the React hooks lint rule leaves it alone)
  page: async ({ page, tmdb }, provide) => {
    await mockTmdb(page, { fail: tmdb === 'fail' })
    await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Trailer</title>' }))
    await provide(page)
  },
})

export { expect }
