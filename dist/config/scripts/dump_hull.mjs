import { chromium } from 'playwright';
import fs from 'fs';
async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
    console.log('navigating to', url);
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);
    const data = await page.evaluate(() => {
        try {
            const r = window.__renderer;
            if (!r)
                return { error: 'no_renderer' };
            const h = r._svgHullCache && r._svgHullCache['carrier'];
            if (!h)
                return { error: 'no_hull' };
            try {
                return { data: h.toDataURL('image/png') };
            }
            catch (e) {
                return { error: String(e) };
            }
        }
        catch (e) {
            return { error: String(e) };
        }
    });
    if (data && data.data) {
        const base = data.data.replace(/^data:image\/png;base64,/, '');
        const fname = `.playwright-mcp/hull_carrier.png`;
        fs.writeFileSync(fname, Buffer.from(base, 'base64'));
        console.log('wrote', fname);
    }
    else {
        console.log('no data', data);
    }
    await browser.close();
}
run().catch(e => { console.error('dump_hull failed', e); process.exit(1); });
