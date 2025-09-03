import fs from 'fs';
import { PNG } from 'pngjs';

const path = '.tmp/marker_focus.png';
if (!fs.existsSync(path)) { console.error('file not found:', path); process.exit(2); }

const data = fs.readFileSync(path);
const png = PNG.sync.read(data);
const { width, height, data: buf } = png;

// magenta color used for marker: 0xff00ff
const target = { r: 255, g: 0, b: 255 };
let found = false;
const samples = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    const r = buf[idx];
    const g = buf[idx+1];
    const b = buf[idx+2];
    // allow small tolerance for anti-aliasing
    const dr = Math.abs(r - target.r);
    const dg = Math.abs(g - target.g);
    const db = Math.abs(b - target.b);
    if (dr <= 8 && dg <= 8 && db <= 8) {
      found = true;
      if (samples.length < 10) samples.push({ x, y, r, g, b });
    }
  }
}

console.log(JSON.stringify({ found, width, height, samples }, null, 2));
