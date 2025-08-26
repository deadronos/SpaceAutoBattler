// scripts/hash-assets.cjs
// Compute short content hashes for SVG assets and emit a mapping file used by the loader.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const svgFolder = path.join(__dirname, '..', 'src', 'config', 'assets', 'svg');
const outPath = path.join(svgFolder, 'svg-hashes.json');

function shortHash(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

function main() {
  if (!fs.existsSync(svgFolder)) {
    console.error('SVG folder not found:', svgFolder);
    process.exit(1);
  }
  const out = {};
  for (const f of fs.readdirSync(svgFolder)) {
    if (!f.toLowerCase().endsWith('.svg')) continue;
    const full = path.join(svgFolder, f);
    try {
      const data = fs.readFileSync(full);
      out[f] = shortHash(data);
    } catch (e) {
      console.warn('Failed to read', full, e && e.message);
    }
  }
  try {
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Wrote svg hashes to', outPath);
  } catch (e) {
    console.error('Failed to write', outPath, e && e.message);
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = { main };
