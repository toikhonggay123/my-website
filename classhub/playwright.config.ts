import { randomUUID } from 'node:crypto'
import { defineConfig } from '@playwright/test'

process.env.CLASSHUB_QA_ID ??= randomUUID()
const web = process.env.CLASSHUB_QA_WEB === '1'
export default defineConfig({
  testDir: './tests',
  testMatch: web ? '**/web-prefix.spec.ts' : '**/*.spec.ts',
  testIgnore: web ? [] : '**/web-prefix.spec.ts',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:' + (web ? '5178' : '5175'),
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
  },
  webServer: (web ? [5178] : [5175, 5176, 5177]).map(port => ({
    command: 'node scripts/qa-server.mjs' + (web ? ' web' : port === 5177 ? ' directory' : port === 5176 ? ' direct' : ''),
    url: 'http://127.0.0.1:' + port + (web ? '/classhub' : '') + '/api/health',
    timeout: 90_000,
    reuseExistingServer: false,
    stderr: 'pipe',
  })),
})
