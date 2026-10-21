import { defineConfig, devices } from '@playwright/test'
import { E2E_PORT, SUPABASE_E2E_PORT } from './e2e/ports.js'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Video playback and the Supabase round trips can take longer than the default 5 s while two builds and every spec
  // share the CPU
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    // In CI every failed attempt keeps its trace, so a test that fails once and passes on retry can still be studied
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    // The app's service worker would answer requests before page.route() mocks see them; pwa.spec.js allows it
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  // Tests run against production builds, served with SPA fallback by e2e/serve.js. Both builds use the dev project
  // (.env.development.local) when it's configured, and neither does in CI.
  webServer: [
    {
      // Most specs: accounts in memory, so 100+ sign-ins stay local and every test starts from a clean account
      command: `npx vite build --mode development --outDir dist-e2e && node e2e/serve.js dist-e2e ${E2E_PORT}`,
      env: { VITE_AUTH_BACKEND: 'memory' },
      url: `http://localhost:${E2E_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // e2e/supabase-auth.spec.js: real Supabase Auth and saved data
      command: `npx vite build --mode development --outDir dist-e2e-supabase && node e2e/serve.js dist-e2e-supabase ${SUPABASE_E2E_PORT}`,
      url: `http://localhost:${SUPABASE_E2E_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
