// This Playwright debug test was moved out of the main test suite.
// To run the debug flow manually, execute:
//   node scripts/playwright-debug-runner.cjs
// Keeping a tiny placeholder here so the test framework won't run the heavy E2E logic.
const { test } = require('@playwright/test');

test.skip('playwright-debug (moved to scripts/playwright-debug-runner.cjs)', async () => {
  // Intentionally skipped: use the standalone script in scripts/
});

module.exports = {};
