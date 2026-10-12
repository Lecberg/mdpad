import { defineConfig } from '@playwright/test'

// E2E tests drive the built app (out/) through Playwright's Electron support.
// Run via `npm run test:e2e`, which builds first.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list'
})
