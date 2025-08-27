import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
const OUT_DIR = path.resolve(process.cwd(), 'test-output');
if (!fs.existsSync(OUT_DIR))
    fs.mkdirSync(OUT_DIR, { recursive: true });
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const logs = [];
    page.on('console', (msg) => {
        try {
            const text = msg.text();
            logs.push({ type: msg.type(), text });
        }
        catch (e) { }
    });
    const url = 'http://localhost:8080/dist/spaceautobattler.html';
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    }
    catch (e) {
        console.error('Failed to open', url, e);
        await browser.close();
        process.exit(2);
    }
    // Enable debug flag
    await page.evaluate(() => {
        try {
            window.__SAB_DEBUG_SVG = true;
            return true;
        }
        catch (e) {
            return false;
        }
    });
    // Give the app a moment to preload assets
    await page.waitForTimeout(1500);
    // Inspect global bridge and attempt cache operations
    const report = await page.evaluate(() => {
        const out = { timestamp: Date.now(), bridge: null, lookups: [] };
        try {
            const bridge = globalThis.__SpaceAutoBattler_svgRenderer;
            out.bridge = !!bridge;
            if (bridge) {
                try {
                    out.bridgeKeys = Object.keys(bridge).filter(k => typeof bridge[k] === 'function');
                }
                catch (e) {
                    out.bridgeKeys = null;
                }
            }
        }
        catch (e) {
            out.bridge = false;
        }
        // Attempt to call getCanvas for several asset keys
        const keys = ['destroyer', 'carrier', 'frigate'];
        for (const k of keys) {
            try {
                let canvasAvailable = false;
                try {
                    const bridge = globalThis.__SpaceAutoBattler_svgRenderer;
                    if (bridge && typeof bridge.getCanvas === 'function') {
                        const c = bridge.getCanvas(k, {}, 128, 128);
                        canvasAvailable = !!c;
                    }
                }
                catch (e) {
                    canvasAvailable = false;
                }
                out.lookups.push({ asset: k, bridgeCanvas: canvasAvailable });
            }
            catch (e) {
                out.lookups.push({ asset: k, error: String(e) });
            }
        }
        // Try calling svgLoader.getCachedHullCanvasSync if available
        try {
            const svgLoader = window.svgLoader || (window.SAB && window.SAB.svgLoader);
            if (svgLoader && typeof svgLoader.getCachedHullCanvasSync === 'function') {
                try {
                    const c = svgLoader.getCachedHullCanvasSync('<svg></svg>', 128, 128, 'destroyer');
                    out.svgLoaderSync = !!c;
                }
                catch (e) {
                    out.svgLoaderSync = false;
                }
            }
            else {
                out.svgLoaderSync = null;
            }
        }
        catch (e) {
            out.svgLoaderSync = null;
        }
        return out;
    });
    // Save screenshot and report
    const screenshotPath = path.join(OUT_DIR, 'playwright_page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const reportPath = path.join(OUT_DIR, 'playwright_svg_cache.json');
    fs.writeFileSync(reportPath, JSON.stringify({ report, logs }, null, 2));
    await browser.close();
    console.log('Wrote report to', reportPath, 'screenshot to', screenshotPath);
})();
