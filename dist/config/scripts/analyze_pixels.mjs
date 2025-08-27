import fs from 'fs';
import { PNG } from 'pngjs';
function colorKey(r, g, b, a) { return `${r},${g},${b},${a}`; }
const path = process.argv[2] || '.playwright-mcp/tinted_carrier_fix_ff4d4d.png';
if (!fs.existsSync(path)) {
    console.error('file not found', path);
    process.exit(2);
}
const data = fs.readFileSync(path);
const png = PNG.sync.read(data);
const { width, height, data: buf } = png;
const counts = new Map();
let total = 0, opaque = 0;
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2], a = buf[idx + 3];
        const key = colorKey(r, g, b, a);
        counts.set(key, (counts.get(key) || 0) + 1);
        total++;
        if (a > 0)
            opaque++;
    }
}
console.log('size', width, height, 'total', total, 'opaque', opaque);
// print top 20 colors by frequency
const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
console.log('top colors:');
for (let i = 0; i < Math.min(20, arr.length); i++) {
    console.log(i + 1, arr[i][0], arr[i][1]);
}
// sample few pixel coords from center region
function sample(px, py) { const idx = (width * py + px) << 2; return [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]]; }
console.log('samples:');
console.log('center', sample(Math.floor(width / 2), Math.floor(height / 2)));
console.log('off1', sample(Math.floor(width * 0.3), Math.floor(height * 0.5)));
console.log('off2', sample(Math.floor(width * 0.7), Math.floor(height * 0.5)));
