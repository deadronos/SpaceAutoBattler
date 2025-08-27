import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
// This test loads the app (tries localhost then file fallback), captures console
// logs, interacts with UI controls if available, and inspects window state for
// ship positions to detect whether ships move (not just rotate/fire).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// With webServer configured in playwright.config.cjs, always navigate to the
// built dist HTML served at baseURL. Default build emits dist/spaceautobattler.html
// and serve:dist serves repository root on port 8080.
function distUrl(baseURL) {
    const base = baseURL && baseURL.endsWith("/")
        ? baseURL
        : baseURL
            ? baseURL + "/"
            : "http://localhost:8080/";
    return base + "dist/spaceautobattler.html";
}
// Disabled by default to avoid flakiness/timeouts in CI. Enable locally via:
//   RUN_DEBUG_PLAYWRIGHT=1 npm run test:playwright
const RUN_DEBUG = process.env.RUN_DEBUG_PLAYWRIGHT === "1";
test.skip(!RUN_DEBUG, "Disabled by default; set RUN_DEBUG_PLAYWRIGHT=1 to run");
test("debug ship movement - interact and inspect state", async ({ page, browserName, }) => {
    const logs = [];
    page.on("console", (msg) => {
        const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
        logs.push(text);
        console.log(text);
    });
    const url = distUrl(test.info().project.use?.baseURL);
    console.log("Navigating to", url);
    const resp = await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
        .catch(() => null);
    if (resp && resp.status && resp.status() >= 400) {
        console.warn("Navigation returned status", resp.status());
    }
    // Give the app time to initialize and ensure key UI controls exist
    await page.waitForLoadState("domcontentloaded").catch(() => null);
    await page.locator("#startPause").first().waitFor({ timeout: 5000 }).catch(() => null);
    // Try clicking common UI buttons (Start, Play, Resume, Run) to start simulation
    const buttonSelectors = [
        "text=Start",
        "text=Play",
        "text=Run",
        "text=Resume",
        "button#start",
        "button#play",
    ];
    for (const sel of buttonSelectors) {
        const el = await page.$(sel);
        if (el) {
            console.log("Clicking", sel);
            await el.click().catch(() => null);
            await page.waitForTimeout(300);
        }
    }
    // If we don't see ships soon, try seeding initial ships via + Red / + Blue
    await page.waitForTimeout(800);
    let shipsCount = await page
        .evaluate(() => {
        // @ts-ignore
        const s = window.gameState ||
            window.state ||
            window.simState ||
            null;
        return s ? (s.ships || []).length : 0;
    })
        .catch(() => 0);
    if ((shipsCount || 0) < 1) {
        const addSelectors = [
            "#addRed",
            'text="+ Red"',
            "#addBlue",
            'text="+ Blue"',
        ];
        for (const sel of addSelectors) {
            const el = await page.$(sel);
            if (el) {
                console.log("Clicking", sel);
                await el.click().catch(() => null);
                await page.waitForTimeout(150);
            }
        }
    }
    // Wait while simulation runs
    await page.waitForTimeout(1500);
    // Try to read window.gameState or window.state or window.simState
    const state = await page
        .evaluate(() => {
        // Expose multiple likely globals used by the app
        // @ts-ignore
        const s = window.gameState ||
            window.state ||
            window.simState ||
            null;
        return s
            ? {
                t: s.t,
                ships: (s.ships || [])
                    .slice(0, 20)
                    .map((sh) => ({
                    id: sh.id,
                    x: sh.x,
                    y: sh.y,
                    angle: sh.angle,
                })),
            }
            : null;
    })
        .catch(() => null);
    // If window state not available, try to query DOM canvas for positions encoded in data attributes
    let ships = state && state.ships ? state.ships : null;
    if (!ships) {
        // Look for elements with data-ship attributes
        ships = await page
            .$$eval("[data-ship-id]", (els) => els.slice(0, 20).map((e) => {
            const id = e.getAttribute("data-ship-id");
            const x = parseFloat(e.getAttribute("data-ship-x") || "NaN");
            const y = parseFloat(e.getAttribute("data-ship-y") || "NaN");
            const angle = parseFloat(e.getAttribute("data-ship-angle") || "NaN");
            return { id, x, y, angle };
        }))
            .catch(() => null);
    }
    const outDir = path.resolve(process.cwd(), "playwright-debug");
    try {
        fs.mkdirSync(outDir, { recursive: true });
    }
    catch (e) { }
    const screenshotPath = path.join(outDir, `ship-debug-${Date.now()}.png`);
    await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => null);
    const result = { url, logs, ships, screenshot: screenshotPath };
    // Save a JSON dump
    try {
        fs.writeFileSync(path.join(outDir, "ship-debug.json"), JSON.stringify(result, null, 2));
    }
    catch (e) { }
    // Basic assertions: ensure we at least observed ships and that positions changed over a short period
    expect(result.ships, "ships present in state").not.toBeNull();
    if (result.ships && result.ships.length > 0) {
        // sample positions now and after a short wait to see if they move
        const before = result.ships.map((s) => ({ id: s.id, x: s.x, y: s.y }));
        await page.waitForTimeout(1200);
        const after = await page
            .evaluate(() => {
            // @ts-ignore
            const s = window.gameState ||
                window.state ||
                window.simState ||
                null;
            return s
                ? (s.ships || [])
                    .slice(0, 20)
                    .map((sh) => ({ id: sh.id, x: sh.x, y: sh.y }))
                : null;
        })
            .catch(() => null);
        if (after && Array.isArray(after)) {
            // compute max delta
            let maxDelta = 0;
            for (const b of before) {
                const a = after.find((x) => x.id === b.id);
                if (!a)
                    continue;
                const dx = (a.x || 0) - (b.x || 0);
                const dy = (a.y || 0) - (b.y || 0);
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > maxDelta)
                    maxDelta = d;
            }
            console.log("max positional delta after 1.2s =", maxDelta);
            // Allow small movement tolerance; expect some movement > 0.5 logical units
            expect(maxDelta, "ships moved significantly").toBeGreaterThan(0.5);
        }
        else {
            // If we couldn't read after positions, fail so user can inspect logs
            expect(after, "able to read ships after wait").not.toBeNull();
        }
    }
});
