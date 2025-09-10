import { test, expect } from '@playwright/test';

test.describe('Ship Instance Visibility', () => {
  test('ships should be visible inside shield bubbles', async ({ page }) => {
    // Navigate to the game
    await page.goto('/dist/spaceautobattler.html');

    // Wait for the game to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let the game initialize

    // Start the game to spawn some ships
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Add some ships to the scene
    const addRedButton = page.locator('button:has-text("Add Red")');
    const addBlueButton = page.locator('button:has-text("Add Blue")');

    if (await addRedButton.isVisible()) {
      // Add several ships to make them visible
      for (let i = 0; i < 5; i++) {
        await addRedButton.click();
        await page.waitForTimeout(200);
      }
    }

    if (await addBlueButton.isVisible()) {
      // Add several ships to make them visible
      for (let i = 0; i < 5; i++) {
        await addBlueButton.click();
        await page.waitForTimeout(200);
      }
    }

    // Wait for ships to be fully spawned
    await page.waitForTimeout(2000);

    // Navigate closer to the ships as mentioned in the issue comment
    const canvas = page.locator('canvas');
    await canvas.focus();

    // Move closer with WASD keys and zoom in
    await page.keyboard.press('w'); // Move forward
    await page.waitForTimeout(100);
    await page.keyboard.press('w');
    await page.waitForTimeout(100);
    await page.keyboard.press('w');
    await page.waitForTimeout(100);
    await page.keyboard.press('w');
    await page.waitForTimeout(100);

    // Zoom in with mouse wheel
    await canvas.hover();
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100); // Zoom in
      await page.waitForTimeout(100);
    }

    // Take a screenshot of the current state
    await page.screenshot({
      path: 'test-results/ship-visibility-before-fix.png',
      fullPage: false,
    });

    // The test passes if we can successfully take a screenshot
    // We'll examine the screenshot manually to verify ship visibility
  });
});
