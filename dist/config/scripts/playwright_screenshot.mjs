import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const fileUrl = 'file://' + path.resolve('dist', 'spaceautobattler_standalone.html');
    await page.goto(fileUrl, { waitUntil: 'load' });
    // wait a bit for animations/renders
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'playwright-standalone-full.png', fullPage: true });
    // capture canvas element if present
    const canvas = await page.$('canvas');
    if (canvas) {
        await canvas.screenshot({ path: 'playwright-standalone-canvas.png' });
    }
    await browser.close();
    console.log('Screenshots saved.');
})();
