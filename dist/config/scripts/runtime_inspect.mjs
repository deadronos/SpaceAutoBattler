import { chromium } from 'playwright';
async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => { try {
        console.log('[page]', msg.type(), msg.text());
    }
    catch (e) { } });
    const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
    console.log('navigating to', url);
    await page.goto(url, { waitUntil: 'load', timeout: 15000 }).catch(e => { console.error('goto failed', e); process.exit(2); });
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
        try {
            const r = window.__renderer || null;
            if (!r)
                return { error: 'no_renderer' };
            const svgHullKeys = r._svgHullCache ? Object.keys(r._svgHullCache) : null;
            let tintedKeys = null;
            try {
                if (r._tintedHullCache && typeof r._tintedHullCache.keys === 'function') {
                    tintedKeys = Array.from(r._tintedHullCache.keys());
                }
            }
            catch (e) {
                tintedKeys = null;
            }
            return { hasRenderer: !!r, svgHullKeys, tintedKeys };
        }
        catch (e) {
            return { error: String(e) };
        }
    });
    console.log('inspect result:', JSON.stringify(info, null, 2));
    await browser.close();
}
run().catch(e => { console.error('runtime inspect failed', e); process.exit(1); });
