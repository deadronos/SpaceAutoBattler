// Smoke test: parse SVG files shipped in assets and extract turret mountpoints
import { readFileSync } from 'fs';
import path from 'path';
// Lightweight local parser for smoke tests: extract rect/ellipse centers as mountpoints
function extractMountsFromSvgText(svgText: string) {
  const mounts: Array<{ x: number; y: number }> = [];
  // match rect x="num" y="num" width="num" height="num"
  const rectRe = /<rect[^>]*\bx\s*=\s*"([0-9.+-]+)"[^>]*\by\s*=\s*"([0-9.+-]+)"[^>]*\bwidth\s*=\s*"([0-9.+-]+)"[^>]*\bheight\s*=\s*"([0-9.+-]+)"[^>]*>/gi;
  let m;
  while ((m = rectRe.exec(svgText)) !== null) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    const w = parseFloat(m[3]);
    const h = parseFloat(m[4]);
    if (Number.isFinite(x) && Number.isFinite(y)) mounts.push({ x: x + w / 2, y: y + h / 2 });
  }
  // match ellipse cx cy
  const ellRe = /<ellipse[^>]*\bcx\s*=\s*"([0-9.+-]+)"[^>]*\bcy\s*=\s*"([0-9.+-]+)"[^>]*\brx\s*=\s*"([0-9.+-]+)"[^>]*\bry\s*=\s*"([0-9.+-]+)"[^>]*>/gi;
  while ((m = ellRe.exec(svgText)) !== null) {
    const cx = parseFloat(m[1]);
    const cy = parseFloat(m[2]);
    mounts.push({ x: cx, y: cy });
  }
  return mounts;
}

function run() {
  const repoRoot = path.resolve(__dirname, '..');
  const svgDir = path.join(repoRoot, 'src', 'config', 'assets', 'svg');
  const files = ['destroyer.svg', 'carrier.svg', 'frigate.svg', 'corvette.svg'];
  for (const f of files) {
    try {
      const p = path.join(svgDir, f);
      const txt = readFileSync(p, 'utf8');
      const mounts = extractMountsFromSvgText(txt);
      console.log(`SVG ${f}: found ${mounts.length} mount(s)`, mounts.slice(0,5));
    } catch (e) {
      console.error('Error parsing', f, String(e));
    }
  }
}

if (require.main === module) run();
