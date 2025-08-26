// Note: this config assumes JavaScript test files in `test/playwright`.
// If your workspace uses TypeScript tests, adjust Playwright's project/language settings
// (or regenerate with `npm init playwright@latest` and choose TypeScript) so the extension
// discovers `.ts` files instead of `.js`.
const { defineConfig, devices } = require('@playwright/test');

// Base URL may be overridden by E2E_BASE environment variable
// load global Playwright listeners so page crash/close events are logged for all tests
try {
  require('./test/playwright/playwright-global-listeners.js');
} catch (e) {
  // best-effort; if the helper is missing we still run tests
}
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
  // Start a local static server that serves the repository root so tests can
  // navigate to the built dist output deterministically. We build first to
  // ensure dist/spaceautobattler.html exists, then serve the root on port 8080.
  webServer: {
    command: process.env.E2E_BUILD === 'false' ? 'npm run serve:dist' : 'npm run build && npm run serve:dist',
    port: 8080,
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
};
