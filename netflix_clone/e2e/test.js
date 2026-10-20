import { expect, test as base } from '@playwright/test'
import { mockTmdb } from './tmdbMock.js'

// Specs import `test` from here: every page starts with the tmdb Edge Function mocked (e2e/tmdbMock.js)
export const test = base.extend({
  // (Playwright's fixture callback is usually called `use`; renamed so the React hooks lint rule leaves it alone)
  page: async ({ page }, provide) => {
    await mockTmdb(page)
    await provide(page)
  },
})

export { expect }
