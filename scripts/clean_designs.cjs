const fs = require('fs');
const path = require('path');
const designsDir = path.join(__dirname, '..', 'memory', 'designs');

const files = fs.readdirSync(designsDir).filter(f => /^DESIGN\d{3}-.*\.md$/i.test(f));
for (const f of files) {
  const p = path.join(designsDir, f);
  let content = fs.readFileSync(p, 'utf8');
  const lines = content.split(/\r?\n/);

  // Strip leading fence lines while they are fence-only lines
  while (lines.length && /^\s*`{3,}(\w*)\s*$/.test(lines[0])) {
    lines.shift();
  }

  // Strip trailing fence-only lines
  while (lines.length && /^\s*`{3,}(\w*)?\s*$/.test(lines[lines.length-1])) {
    lines.pop();
  }

  // Remove leading/trailing empty lines
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length-1].trim() === '') lines.pop();

  // Ensure first heading has a blank line after it
  if (lines.length && lines[0].startsWith('#')) {
    if (lines.length === 1) lines.push('');
    else if (lines[1].trim() !== '') lines.splice(1, 0, '');
  }

  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}
console.log('Cleaned', files.length, 'DESIGN files');
