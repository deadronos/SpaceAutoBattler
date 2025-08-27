import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
// This debug test spawns specific ship types and captures screenshots
// for visual inspection. It's gated behind RUN_DEBUG_PLAYWRIGHT to avoid
// running in CI by accident. Enable via:
// RUN_DEBUG_PLAYWRIGHT=1 npx playwright test test/playwright/visual_inspect_hulls.spec.ts --project=chromium --headed
const RUN_DEBUG = process.env.RUN_DEBUG_PLAYWRIGHT === '1';
test.skip(!RUN_DEBUG, 'Disabled by default; set RUN_DEBUG_PLAYWRIGHT=1 to run');
function distUrl(baseURL) {
    const base = baseURL && baseURL.endsWith('/') ? baseURL : baseURL ? baseURL + '/' : 'http://localhost:8080/';
    return base + 'dist/spaceautobattler.html';
}
test('visual inspect hulls - destroyer/frigate/corvette/carrier', async ({ page }) => {
    const outDir = path.resolve(process.cwd(), 'playwright-debug');
    try {
        fs.mkdirSync(outDir, { recursive: true });
    }
    catch (e) { }
    // Capture browser console messages for debugging placeholder/fallback logs
    const consoleLogs = [];
    // Only capture console messages that include our diagnostic prefixes to avoid noisy 3rd-party logs
    const DIAGNOSTIC_PREFIXES = ['[svgRenderer]', '[CanvasRenderer]', 'XML Parsing Error', '__SpaceAutoBattler_svgRenderer'];
    page.on('console', (msg) => {
        try {
            const text = msg.text();
            if (!text)
                return;
            for (const pf of DIAGNOSTIC_PREFIXES) {
                if (text.indexOf(pf) !== -1) {
                    consoleLogs.push({ type: msg.type(), text });
                    try {
                        console.log('[browser]', msg.type(), text);
                    }
                    catch (e) { }
                    break;
                }
            }
        }
        catch (e) { }
    });
    // Capture network requests/responses so we can see exact URLs and statuses
    const networkRequests = [];
    const networkResponses = [];
    const networkFailures = [];
    page.on('request', (req) => {
        try {
            networkRequests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType() });
        }
        catch (e) { }
    });
    page.on('response', (res) => {
        try {
            networkResponses.push({ url: res.url(), status: res.status(), ok: res.ok() });
        }
        catch (e) { }
    });
    page.on('requestfailed', (rf) => {
        try {
            let f = undefined;
            try {
                f = (typeof rf.failure === 'function') ? rf.failure() : undefined;
            }
            catch (ee) {
                f = undefined;
            }
            networkFailures.push({ url: rf.url(), failure: f && (f.errorText || f.message) ? (f.errorText || f.message) : String(f) });
        }
        catch (e) { }
    });
    const url = distUrl(test.info().project.use?.baseURL);
    // Ensure the app will await SVG prewarm on startup so rasterized canvases
    // are ready before the page becomes interactive. This avoids capturing
    // placeholder canvases in visual tests.
    await page.addInitScript(() => { window.__AWAIT_SVG_PREWARM = true; });
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    // Wait for UI controls (ship type combobox and add buttons) to appear.
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    const combo = page.getByRole('combobox', { name: /ship type/i }).first();
    await combo.waitFor({ timeout: 5000 }).catch(() => null);
    const shipTypes = ['destroyer', 'frigate', 'corvette', 'carrier'];
    const results = {};
    // We'll step through each type one-by-one: spawn -> start -> wait -> screenshot -> pause -> reset
    const stepFlow = async (type) => {
        console.log('Selecting type', type);
        // set select value via evaluation to avoid relying on option text matching
        await page.evaluate((t) => {
            const sel = document.querySelector('select[title="Ship type"]') || document.querySelector('select');
            if (sel)
                sel.value = t;
            // dispatch change event
            sel && sel.dispatchEvent && sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, type).catch(() => null);
        // Click the + Red button to spawn a red ship of that type
        const addRed = await page.$('text="+ Red"') || await page.$('#addRed');
        if (addRed) {
            await addRed.click().catch(() => null);
        }
        else {
            // try generic add button
            const addBtn = await page.$('button#add') || await page.$('text=Add');
            if (addBtn)
                await addBtn.click().catch(() => null);
        }
        // Wait a short time for the ship to spawn
        await page.waitForTimeout(600);
        // If the svgRenderer test helper is available, await rasterization of the hull
        try {
            await page.evaluate(async (t) => {
                try {
                    // @ts-ignore
                    const api = window.__SpaceAutoBattler_svgRenderer;
                    if (api && typeof api._waitForAssetReady === 'function') {
                        // Wait for a non-placeholder canvas for this asset (timeout 5s)
                        await api._waitForAssetReady(t, {}, 128, 128, 5000);
                    }
                }
                catch (e) { }
            }, type).catch(() => null);
        }
        catch (e) { }
        // Capture a full-page screenshot showing the spawned ship (before starting simulation)
        const tsSpawn = Date.now();
        const spawnScreenshotPath = path.join(outDir, `${type}-spawned-${tsSpawn}.png`);
        await page.screenshot({ path: spawnScreenshotPath, fullPage: true }).catch(() => null);
        // Start the simulation
        const click = async (selectors) => {
            for (const sel of selectors) {
                const el = await page.$(sel);
                if (el) {
                    await el.click().catch(() => null);
                    return true;
                }
            }
            return false;
        };
        const started = await click(['text=Start', 'text=Play', 'text=Run', 'button#start', 'button#play']);
        if (!started)
            console.warn('Start button not found for type', type);
        // Wait while simulation runs so the renderer updates
        await page.waitForTimeout(900);
        // Take after-start screenshot for this type
        const afterTs = Date.now();
        const afterScreenshotPath = path.join(outDir, `${type}-after-start-${afterTs}.png`);
        await page.screenshot({ path: afterScreenshotPath, fullPage: true }).catch(() => null);
        // Pause (click start/play again) to stop simulation
        await click(['text=Start', 'text=Play', 'text=Run', 'button#start', 'button#play']);
        // Reset the simulation (if reset button exists)
        await click(['text=Reset', 'button#reset', 'text=Reset Simulation']).catch(() => null);
        // Try to query window game state to collect ship info for this type
        const shipsOfType = await page.evaluate((t) => {
            try {
                // @ts-ignore
                const s = window.gameState || window.state || window.simState || null;
                if (!s || !Array.isArray(s.ships))
                    return null;
                return s.ships.filter((sh) => sh.type === t).map((sh) => ({ id: sh.id, x: sh.x, y: sh.y, angle: sh.angle, type: sh.type }));
            }
            catch (e) {
                return null;
            }
        }, type).catch(() => null);
        results[type] = { spawnedScreenshot: spawnScreenshotPath, afterScreenshot: afterScreenshotPath, ships: shipsOfType };
    };
    for (const type of shipTypes) {
        // step through each ship type
        // small delay between steps to keep UI stable
        await page.waitForTimeout(200);
        await stepFlow(type);
    }
    // Additional diagnostic: collect the in-page AssetsConfig.svgAssets (if present)
    try {
        const assetConfig = await page.evaluate(() => {
            // @ts-ignore
            const cfg = window.AssetsConfig || window.assetsConfig || null;
            try {
                if (!cfg || !cfg.svgAssets)
                    return null;
                const entries = {};
                for (const k of Object.keys(cfg.svgAssets))
                    entries[k] = cfg.svgAssets[k];
                return entries;
            }
            catch (e) {
                return null;
            }
        });
        const assetDiag = { assetConfig: assetConfig || null, networkRequests, networkResponses, networkFailures };
        try {
            fs.writeFileSync(path.join(outDir, `asset-fetch-diag-${Date.now()}.json`), JSON.stringify(assetDiag, null, 2));
        }
        catch (e) { }
        console.log('Wrote asset fetch diagnostic to playwright-debug');
    }
    catch (e) {
        console.warn('asset diag failed', String(e));
    }
    // Click the Start/Play/Run button once to begin the simulation and capture an after-start screenshot
    const startSelectors = ['text=Start', 'text=Play', 'text=Run', 'button#start', 'button#play'];
    let clicked = false;
    for (const sel of startSelectors) {
        const el = await page.$(sel);
        if (el) {
            console.log('Clicking', sel, 'to start simulation');
            await el.click().catch(() => null);
            clicked = true;
            break;
        }
    }
    if (!clicked)
        console.warn('Start button not found; simulation may remain paused');
    // Wait a short time for simulation to step
    await page.waitForTimeout(900);
    const afterScreenshot = path.join(outDir, `after-start-${Date.now()}.png`);
    await page.screenshot({ path: afterScreenshot, fullPage: true }).catch(() => null);
    // Write JSON summary for inspection
    const outJson = path.join(outDir, `visual-inspect-${Date.now()}.json`);
    try {
        fs.writeFileSync(outJson, JSON.stringify({ results, afterScreenshot }, null, 2));
    }
    catch (e) {
        console.warn('write json failed', e);
    }
    console.log('Wrote visual inspect results to', outJson);
    try {
        const logPath = path.join(outDir, `playwright-console-${Date.now()}.log`);
        const lines = consoleLogs.map((l) => `[${l.type}] ${l.text}`);
        fs.writeFileSync(logPath, lines.join('\n'));
        console.log('Wrote browser console log to', logPath);
    }
    catch (e) { }
});
