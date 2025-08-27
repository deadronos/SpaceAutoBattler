import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
function hexToRgb(hex) {
    if (!hex)
        return null;
    let h = hex.replace(/^#/, '');
    if (h.length === 3)
        h = h.split('').map(c => c + c).join('');
    if (h.length !== 6)
        return null;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b };
}
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h = h * 60;
    }
    return [h, s, l];
}
function hslToRgb(h, s, l) {
    h = (h % 360 + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) {
        r1 = c;
        g1 = x;
        b1 = 0;
    }
    else if (h < 120) {
        r1 = x;
        g1 = c;
        b1 = 0;
    }
    else if (h < 180) {
        r1 = 0;
        g1 = c;
        b1 = x;
    }
    else if (h < 240) {
        r1 = 0;
        g1 = x;
        b1 = c;
    }
    else if (h < 300) {
        r1 = x;
        g1 = 0;
        b1 = c;
    }
    else {
        r1 = c;
        g1 = 0;
        b1 = x;
    }
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return [r, g, b];
}
function loadPng(p) {
    const buf = fs.readFileSync(p);
    return PNG.sync.read(buf);
}
function writePng(png, outPath) {
    const buf = PNG.sync.write(png);
    fs.writeFileSync(outPath, buf);
}
function applyHslTintToPng(basePng, teamHex) {
    const teamRgb = hexToRgb(teamHex) || { r: 255, g: 85, b: 85 };
    const teamHue = rgbToHsl(teamRgb.r, teamRgb.g, teamRgb.b)[0];
    const img = basePng;
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 8)
            continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const [h, s, l] = rgbToHsl(r, g, b);
        const [nr, ng, nb] = hslToRgb(teamHue, s, l);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
    }
    return img;
}
function luminance(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function compareLuminance(base, other) {
    if (base.width !== other.width || base.height !== other.height)
        throw new Error('Size mismatch');
    const bd = base.data, od = other.data;
    let n = 0, sumBase = 0, sumDiff = 0;
    for (let i = 0; i < bd.length; i += 4) {
        const ba = bd[i + 3];
        if (ba === 0)
            continue;
        const lb = luminance(bd[i], bd[i + 1], bd[i + 2]);
        const lo = luminance(od[i], od[i + 1], od[i + 2]);
        sumBase += lb;
        sumDiff += Math.abs(lb - lo);
        n++;
    }
    return { meanBase: sumBase / n, meanAbsDiff: sumDiff / n, pixelsCompared: n, relDiff: (sumDiff / n) / (sumBase / n) };
}
(async function () {
    const outDir = path.join(process.cwd(), 'test-output');
    const hull = path.join(outDir, 'destroyer_hull_only.png');
    const mult = path.join(outDir, 'destroyer_tint_multiply.png');
    const flat = path.join(outDir, 'destroyer_tint_flat.png');
    const hslOut = path.join(outDir, 'destroyer_tint_hsl.png');
    const teamColor = '#ff5555';
    if (!fs.existsSync(hull)) {
        console.error('Missing hull image:', hull);
        process.exit(2);
    }
    const base = loadPng(hull);
    // create HSL tinted
    const hsl = applyHslTintToPng(PNG.sync.read(fs.readFileSync(hull)), teamColor);
    writePng(hsl, hslOut);
    console.log('Wrote HSL tinted image to', hslOut);
    const mulP = fs.existsSync(mult) ? loadPng(mult) : null;
    const flatP = fs.existsSync(flat) ? loadPng(flat) : null;
    const hslP = loadPng(hslOut);
    console.log('Comparing HSL -> base...');
    console.log(JSON.stringify(compareLuminance(base, hslP), null, 2));
    if (mulP) {
        console.log('Comparing Multiply -> base...');
        console.log(JSON.stringify(compareLuminance(base, mulP), null, 2));
    }
    if (flatP) {
        console.log('Comparing Flat -> base...');
        console.log(JSON.stringify(compareLuminance(base, flatP), null, 2));
    }
})();
