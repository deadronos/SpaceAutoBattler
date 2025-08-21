import { test } from '@playwright/test';

// This temporary test intentionally fails to exercise the global listeners' dump & tracing
// It is skipped during CI/full test runs as part of cleanup.
test.skip('temp failure to generate dump (skipped in full runs)', async ({ page }) => {
  await page.goto('about:blank');
  // write something to console
  await page.evaluate(() => console.error('temp-failure-debug: starting failure test'));
  // cause a real page error
  await page.evaluate(() => { throw new Error('intentional-failure-for-dump'); });
});
