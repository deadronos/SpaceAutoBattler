import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
async function run() {
    const outDir = path.resolve('test-output');
    fs.mkdirSync(outDir, { recursive: true });
    const svgPath = path.resolve('src', 'config', 'assets', 'svg', 'destroyer.svg');
    const svgText = fs.readFileSync(svgPath, 'utf8');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
    // base page with container
    const content = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;display:flex;align-items:center;justify-content:center;">` +
        `<div id="wrap" style="position:relative;display:inline-block;isolation:isolate">` + svgText + `</div></body></html>`;
    await page.setContent(content, { waitUntil: 'load' });
    // ensure svg scaled to 512x512 for screenshots
    await page.evaluate(() => {
        const svg = document.querySelector('#wrap svg');
        if (svg) {
            svg.setAttribute('width', '512');
            svg.setAttribute('height', '512');
            svg.style.display = 'block';
        }
    });
    // original screenshot (with turrets)
    const svgEl = await page.$('#wrap svg');
    if (svgEl) {
        await svgEl.screenshot({ path: path.join(outDir, 'destroyer_original.png') });
    }
    // create hull-only by removing turret selectors
    await page.evaluate(() => {
        const turretSelectors = '[data-turret], .turret, [data-weapon], .weapon, [data-turret-slot], [data-weapon-slot]';
        const svg = document.querySelector('#wrap svg');
        if (!svg)
            return;
        const turrets = Array.from(svg.querySelectorAll(turretSelectors));
        for (const t of turrets)
            t.remove();
    });
    const svgEl2 = await page.$('#wrap svg');
    if (svgEl2) {
        await svgEl2.screenshot({ path: path.join(outDir, 'destroyer_hull_only.png') });
    }
    // multiply tint: add an overlay div that uses mix-blend-mode: multiply
    await page.evaluate(() => {
        const wrap = document.getElementById('wrap');
        if (!wrap)
            return;
        // create overlay sized to svg's bounding box
        const svg = wrap.querySelector('svg');
        if (!svg)
            return;
        const overlay = document.createElement('div');
        overlay.id = 'tintOverlay';
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = svg.getAttribute('width') + 'px';
        overlay.style.height = svg.getAttribute('height') + 'px';
        overlay.style.background = '#ff5555';
        overlay.style.mixBlendMode = 'multiply';
        overlay.style.pointerEvents = 'none';
        overlay.style.opacity = '1';
        wrap.appendChild(overlay);
    });
    const svgEl3 = await page.$('#wrap');
    if (svgEl3) {
        await svgEl3.screenshot({ path: path.join(outDir, 'destroyer_tint_multiply.png') });
    }
    // source-atop / flat recolor: remove overlay and set fill attributes on team-fill elements
    await page.evaluate(() => {
        const overlay = document.getElementById('tintOverlay');
        if (overlay && overlay.parentNode)
            overlay.parentNode.removeChild(overlay);
        const svg = document.querySelector('#wrap svg');
        if (!svg)
            return;
        const els = Array.from(svg.querySelectorAll('[data-team],[data-team-slot],[class*="team-fill-"]'));
        for (const el of els) {
            try {
                el.setAttribute('fill', '#ff5555');
                const stroke = el.getAttribute('stroke');
                if (stroke)
                    el.setAttribute('stroke', '#cc4444');
            }
            catch (e) { }
        }
    });
    const svgEl4 = await page.$('#wrap svg');
    if (svgEl4) {
        await svgEl4.screenshot({ path: path.join(outDir, 'destroyer_tint_flat.png') });
    }
    await browser.close();
    console.log('Saved visuals to', outDir);
}
run().catch((e) => { console.error(e); process.exit(2); });
