import { test, expect } from '@playwright/test';

// This test validates that the UI ship type dropdown is populated with all
// ship types from the runtime entities config in a browser bundle.
// It catches regressions where only a fallback (fighter/carrier) is available.

test.describe('UI ship types dropdown', () => {
  test('ship type dropdown shows all core types', async ({ page }) => {
    // Navigate to the built app (served from repository root)
    await page.goto('/dist/spaceautobattler.html');

    // Prefer role-based locator; the select has a title="Ship type" which becomes its name
    const combo = page.getByRole('combobox', { name: /ship type/i });
    await expect(combo).toBeVisible();

  const options = combo.locator('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);

  const texts = await options.allTextContents();
    // Expected baseline types from entitiesConfig
    const expected = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
    for (const t of expected) {
      expect.soft(texts, `dropdown should include type ${t}`).toContain(t);
    }
  });
});
