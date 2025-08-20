const { defineConfig, devices } = require('@playwright/test');

// Base URL may be overridden by E2E_BASE environment variable
const baseURL = process.env.E2E_BASE || 'http://localhost:8080/';

module.exports = {
  timeout: 30 * 1000, // per-test timeout
  expect: { timeout: 5000 },
  testDir: './test/playwright',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10 * 1000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
};
