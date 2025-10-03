import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const baseDir = path.join(process.cwd(), 'test', 'playwright', 'baselines');
if (!fs.existsSync(baseDir)) {
  console.error('Baselines directory not found:', baseDir);
  process.exit(2);
}

function analyzeImage(p) {
  const buf = fs.readFileSync(p);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  let nonBlack = 0;
  let greenish = 0;
  let total = width * height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;
    const bright = (r + g + b) / 3;
    if (bright > 6) nonBlack++;
    if (g > r + 10 && g > b + 10 && g > 20) greenish++;
  }
  return {
    path: p,
    width,
    height,
    total,
    nonBlack,
    nonBlackRatio: nonBlack / total,
    greenish,
    greenishRatio: greenish / total,
  };
}

const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.png'));
if (files.length === 0) {
  console.error('No PNG baselines found in', baseDir);
  process.exit(1);
}

const results = files.map((f) => analyzeImage(path.join(baseDir, f)));
console.log('Baseline analysis results:');
for (const r of results) {
  console.log(`- ${path.basename(r.path)}: ${r.width}x${r.height}, nonBlackRatio=${(r.nonBlackRatio*100).toFixed(2)}%, greenishRatio=${(r.greenishRatio*100).toFixed(4)}%`);
}

// Find images that look empty (low nonBlackRatio) and those with small green text
const empties = results.filter((r) => r.nonBlackRatio < 0.01);
const greenText = results.filter((r) => r.greenishRatio > 0.0005 && r.greenishRatio < 0.02);

console.log('Summary:');
console.log(`- empty-ish images (<1% non-black): ${empties.length}`);
console.log(`- images with small green text (likely 'Initializing...'): ${greenText.length}`);

if (empties.length > 0) {
  console.log('Empty-ish files:');
  empties.forEach((e) => console.log('  ', path.basename(e.path)));
}
if (greenText.length > 0) {
  console.log('Green-text files:');
  greenText.forEach((e) => console.log('  ', path.basename(e.path)));
}

// Exit codes: 0 ok, 3 if all baselines empty/green only
if (results.every((r) => r.nonBlackRatio < 0.02 || r.greenishRatio > 0.0005)) {
  console.warn('All baselines are mostly empty or contain only small green text. This indicates renderer did not draw the scene content.');
  process.exit(3);
}

process.exit(0);
