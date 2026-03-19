const fs = require('fs');
const path = require('path');
const designsDir = path.join(__dirname, '..', 'memory', 'designs');

function slugFromFilename(fname) {
  const m = fname.match(/^DESIGN\d{3}-(.+)\.md$/i);
  if (!m) return fname.replace(/\.md$/, '');
  return m[1];
}

// gather current DESIGN files only (exclude ARCHIVE and mapping/index)
let files = fs.readdirSync(designsDir).filter((f) => /^DESIGN\d{3}-.+\.md$/i.test(f));

// get mtime for each and sort by mtime descending (newest first)
files = files
  .map((f) => {
    const p = path.join(designsDir, f);
    const st = fs.statSync(p);
    return { name: f, mtime: st.mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

const mapping = [];
let idx = 1;
for (const entry of files) {
  const f = entry.name;
  const slug = slugFromFilename(f);
  const newNameBase = `DESIGN${String(idx).padStart(3, '0')}-${slug}`;
  const newName = `${newNameBase}.md`;
  const oldPath = path.join(designsDir, f);
  const newPath = path.join(designsDir, newName);

  if (f === newName) {
    mapping.push({ from: f, to: newName, action: 'unchanged' });
  } else {
    // if newPath exists and it's not the same file, choose an available name
    let finalNewName = newName;
    let finalNewPath = newPath;
    if (fs.existsSync(finalNewPath)) {
      // if existing file is the same inode? on Windows skip check; just append suffix
      let k = 1;
      do {
        finalNewName = `${newNameBase}-r${k}.md`;
        finalNewPath = path.join(designsDir, finalNewName);
        k++;
      } while (fs.existsSync(finalNewPath));
    }
    fs.renameSync(oldPath, finalNewPath);
    mapping.push({ from: f, to: finalNewName, action: 'renamed', mtime: entry.mtime });
  }
  idx++;
}

// Append renumbering-by-mtime section to mapping file
const mapFile = path.join(designsDir, 'RENAME_MAPPING.md');
let mapContent = '';
if (fs.existsSync(mapFile)) mapContent = fs.readFileSync(mapFile, 'utf8');
mapContent += '\n\n# Renumbering by mtime (newest-first)\n\n';
mapContent += mapping.map((m) => `- ${m.from} -> ${m.to} (${m.action})`).join('\n');
fs.writeFileSync(mapFile, mapContent, 'utf8');
console.log('Renumber-by-mtime complete:', mapping.length, 'files processed');
console.log('Updated RENAME_MAPPING.md with renumbering-by-mtime section');
