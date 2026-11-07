import { randomUUID } from 'node:crypto'
import { defineConfig } from '@playwright/test'

// Run from the classhub folder: node node_modules/@playwright/test/cli.js test --config accounts/playwright.config.ts
process.env.ACCOUNTS_QA_ID ??= randomUUID()
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5191',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
  },
  outputDir: './test-results',
  webServer: {
    command: 'node accounts/scripts/qa-server.mjs',
    cwd: '..',
    url: 'http://127.0.0.1:5191/api/health',
    timeout: 90_000,
    reuseExistingServer: false,
    stderr: 'pipe',
  },
})
