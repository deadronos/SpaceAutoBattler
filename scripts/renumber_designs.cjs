const fs = require('fs');
const path = require('path');
const designsDir = path.join(__dirname, '..', 'memory', 'designs');

function slugFromFilename(fname) {
  // fname like DESIGN###-slug.md
  const m = fname.match(/^DESIGN\d{3}-(.+)\.md$/i);
  if (!m) return fname.replace(/\.md$/, '');
  return m[1];
}

const files = fs
  .readdirSync(designsDir)
  .filter((f) => /^DESIGN\d{3}-.+\.md$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
const mapping = [];
let idx = 1;
for (const f of files) {
  const slug = slugFromFilename(f);
  const newName = `DESIGN${String(idx).padStart(3, '0')}-${slug}`;
  const oldPath = path.join(designsDir, f);
  const newPath = path.join(designsDir, newName);
  if (oldPath === newPath) {
    mapping.push({ from: f, to: newName, action: 'unchanged' });
  } else {
    // If target exists already (should not), add suffix
    let finalNewPath = newPath;
    let finalNewName = newName;
    if (fs.existsSync(finalNewPath)) {
      // append -r<number>
      let k = 1;
      do {
        finalNewName = `${newName}-r${k}.md`;
        finalNewPath = path.join(designsDir, finalNewName);
        k++;
      } while (fs.existsSync(finalNewPath));
    } else {
      finalNewName = `${newName}.md`;
      finalNewPath = path.join(designsDir, finalNewName);
    }
    // rename file
    fs.renameSync(oldPath, finalNewPath);
    mapping.push({ from: f, to: finalNewName, action: 'renamed' });
  }
  idx++;
}

// Update RENAME_MAPPING.md to reflect renames (append section)
const mapFile = path.join(designsDir, 'RENAME_MAPPING.md');
let mapContent = '';
if (fs.existsSync(mapFile)) mapContent = fs.readFileSync(mapFile, 'utf8');
mapContent += '\n\n# Renumbering pass\n\n';
mapContent += mapping.map((m) => `- ${m.from} -> ${m.to} (${m.action})`).join('\n');
fs.writeFileSync(mapFile, mapContent, 'utf8');
console.log('Renumbering complete:', mapping.length, 'files processed');
console.log('Updated RENAME_MAPPING.md with renumbering section');
