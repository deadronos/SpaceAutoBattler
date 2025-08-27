import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
function loadPngBuffer(filePath) {
    const buf = fs.readFileSync(filePath);
    return PNG.sync.read(buf);
}
function luminance(r, g, b) {
    // sRGB luminance approximation
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function compareLuminance(base, other) {
    // both PNG objects from pngjs
    if (base.width !== other.width || base.height !== other.height) {
        throw new Error('Image sizes differ');
    }
    const w = base.width, h = base.height;
    const baseData = base.data;
    const otherData = other.data;
    let n = 0;
    let sumDiff = 0;
    let sumBase = 0;
    for (let i = 0; i < baseData.length; i += 4) {
        const br = baseData[i], bg = baseData[i + 1], bb = baseData[i + 2], ba = baseData[i + 3];
        const or = otherData[i], og = otherData[i + 1], ob = otherData[i + 2], oa = otherData[i + 3];
        if (ba === 0)
            continue; // transparent in base, skip
        const lb = luminance(br, bg, bb);
        const lo = luminance(or, og, ob);
        sumBase += lb;
        sumDiff += Math.abs(lb - lo);
        n++;
    }
    return {
        meanBase: sumBase / n,
        meanAbsDiff: sumDiff / n,
        pixelsCompared: n,
        relDiff: (sumDiff / n) / (sumBase / n)
    };
}
(async function main() {
    const outDir = path.join(process.cwd(), 'test-output');
    const hullOnly = path.join(outDir, 'destroyer_hull_only.png');
    const tintMultiply = path.join(outDir, 'destroyer_tint_multiply.png');
    const tintFlat = path.join(outDir, 'destroyer_tint_flat.png');
    if (!fs.existsSync(hullOnly)) {
        console.error('Missing', hullOnly);
        process.exit(2);
    }
    const basePng = loadPngBuffer(hullOnly);
    const mulPng = loadPngBuffer(tintMultiply);
    const flatPng = loadPngBuffer(tintFlat);
    console.log('Comparing multiply -> base...');
    const mulStats = compareLuminance(basePng, mulPng);
    console.log(JSON.stringify(mulStats, null, 2));
    console.log('Comparing flat -> base...');
    const flatStats = compareLuminance(basePng, flatPng);
    console.log(JSON.stringify(flatStats, null, 2));
    // Simple heuristic: prefer multiply if relDiff < flat relDiff
    if (mulStats.relDiff < flatStats.relDiff) {
        console.log('Multiply preserves luminosity better than flat.');
    }
    else {
        console.log('Flat preserves luminosity better or equal. Consider adjusting tint approach.');
    }
})();
