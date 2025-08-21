---
description: 'Playwright test generation instructions'
applyTo: '**'
---

## Test Writing Guidelines

### Code Quality Standards
- **Locators**: Prioritize user-facing, role-based locators (`getByRole`, `getByLabel`, `getByText`, etc.) for resilience and accessibility. Use `test.step()` to group interactions and improve test readability and reporting.
- **Assertions**: Use auto-retrying web-first assertions. These assertions start with the `await` keyword (e.g., `await expect(locator).toHaveText()`). Avoid `expect(locator).toBeVisible()` unless specifically testing for visibility changes.
- **Timeouts**: Rely on Playwright's built-in auto-waiting mechanisms. Avoid hard-coded waits or increased default timeouts.
- **Clarity**: Use descriptive test and step titles that clearly state the intent. Add comments only to explain complex logic or non-obvious interactions.


### Test Structure
- **Imports**: Start with `import { test, expect } from '@playwright/test';`.
- **Organization**: Group related tests for a feature under a `test.describe()` block.
- **Hooks**: Use `beforeEach` for setup actions common to all tests in a `describe` block (e.g., navigating to a page).
- **Titles**: Follow a clear naming convention, such as `Feature - Specific action or scenario`.


### File Organization
- **Location**: Store all test files in the `tests/` directory.
- **Naming**: Use the convention `<feature-or-page>.spec.ts` (e.g., `login.spec.ts`, `search.spec.ts`).
- **Scope**: Aim for one test file per major application feature or page.

### Assertion Best Practices
- **UI Structure**: Use `toMatchAriaSnapshot` to verify the accessibility tree structure of a component. This provides a comprehensive and accessible snapshot.
- **Element Counts**: Use `toHaveCount` to assert the number of elements found by a locator.
- **Text Content**: Use `toHaveText` for exact text matches and `toContainText` for partial matches.
- **Navigation**: Use `toHaveURL` to verify the page URL after an action.


## Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Movie Search Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('https://debs-obrien.github.io/playwright-movies-app');
  });

  test('Search for a movie by title', async ({ page }) => {
    await test.step('Activate and perform search', async () => {
      await page.getByRole('search').click();
      const searchInput = page.getByRole('textbox', { name: 'Search Input' });
      await searchInput.fill('Garfield');
      await searchInput.press('Enter');
    });

    await test.step('Verify search results', async () => {
      // Verify the accessibility tree of the search results
      await expect(page.getByRole('main')).toMatchAriaSnapshot(`
        - main:
          - heading "Garfield" [level=1]
          ---
          description: 'Playwright TS quick guide — one-line receipt, short plan, resilient locators, and a minimal example.'
          applyTo: '**'
          ---

          # Playwright (TypeScript) — Quick Guide

          Receipt: "Write a resilient Playwright test for <feature> — plan: scenario, actions, expected assertions."

          Plan (3 steps):
          - 1) Declare scenario and page state (URL, auth). 2) Perform user actions using role-based locators. 3) Assert user-visible outcomes with web-first assertions.

          Core rules (short):
          - Prefer user-facing locators: getByRole/getByLabel/getByText.  
          - Use await + auto-retrying assertions (toHaveText/toHaveURL/toHaveCount).  
          - Group related interactions with test.step for clarity.  
          - Avoid hard waits; prefer built-in waits and expect-based checks.

          Minimal example:
          import { test, expect } from '@playwright/test';

          test('Feature - Search returns results', async ({ page }) => {
            await page.goto('http://localhost:8080/');
            await test.step('search for term', async () => {
              await page.getByRole('search').click();
              const input = page.getByRole('textbox', { name: 'Search Input' });
              await input.fill('Garfield');
              await input.press('Enter');
            });
            await expect(page.getByRole('main')).toContainText('Garfield');
          });

          Checklist before merge:
          - [ ] Uses role-based locators where possible.  
          - [ ] No fixed sleeps or flaky selectors.  
          - [ ] Clear test title and steps.  
          - [ ] Assertions reflect user-visible behaviour.

          Run: `npx playwright test --project=chromium`

          End.
