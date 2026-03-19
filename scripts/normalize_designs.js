const fs = require('fs');
const path = require('path');

const designsDir = path.join(__dirname, '..', 'memory', 'designs');
const archiveDir = path.join(designsDir, 'ARCHIVE');
fs.mkdirSync(archiveDir, { recursive: true });

function slugify(name) {
  return name
    .replace(/^(design-|DESIGN-|DESIGN\d+[-_]?)/i, '')
    .replace(/\.md$/i, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Gather files (md) in designsDir excluding ARCHIVE and this script output
const allFiles = fs.readdirSync(designsDir).filter((f) => f.endsWith('.md'));
// Move originals into archive first to avoid clobbering
for (const f of allFiles) {
  const src = path.join(designsDir, f);
  const dest = path.join(archiveDir, f);
  // If file already in ARCHIVE skip
  if (src.includes(path.sep + 'ARCHIVE' + path.sep)) continue;
  fs.renameSync(src, dest);
}

const archivedFiles = fs
  .readdirSync(archiveDir)
  .filter((f) => f.endsWith('.md'))
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
const mapping = [];
let idx = 1;
for (const f of archivedFiles) {
  const contentPath = path.join(archiveDir, f);
  let content = fs.readFileSync(contentPath, 'utf8');

  // Remove a single top-level code-fence wrapper if present
  // Match fences of 3 or more backticks possibly with language name
  const openingFenceMatch = content.match(/^(\s*)(`{3,}|`{4,})([^\n\r]*)\r?\n/);
  if (openingFenceMatch) {
    const fence = openingFenceMatch[2];
    // Find matching ending fence
    const endFenceRegex = new RegExp('\n' + fence + 's*$', 'm');
    if (endFenceRegex.test(content)) {
      // strip the first fence line and the last fence
      content = content.replace(/^(\s*)(`{3,}|`{4,})([^\n\r]*)\r?\n/, '');
      content = content.replace(endFenceRegex, '\n');
    }
  }

  // Ensure first heading has a blank line after it
  const lines = content.split(/\r?\n/);
  if (lines[0] && lines[0].startsWith('#')) {
    if (lines.length > 1 && lines[1].trim() !== '') {
      lines.splice(1, 0, '');
      content = lines.join('\n');
    }
  }

  const base = slugify(f);
  const newName = `DESIGN${String(idx).padStart(3, '0')}-${base || 'untitled'}.md`;
  const newPath = path.join(designsDir, newName);

  // If newPath already exists (rare), append a suffix
  if (fs.existsSync(newPath)) {
    const altName = `DESIGN${String(idx).padStart(3, '0')}-${base || 'untitled'}-dup.md`;
    fs.writeFileSync(path.join(designsDir, altName), content, 'utf8');
    mapping.push({ original: f, created: altName });
  } else {
    fs.writeFileSync(newPath, content, 'utf8');
    mapping.push({ original: f, created: newName });
  }
  idx++;
}

// Write mapping file
const mapOut = mapping.map((m) => `- ${m.original} -> ${m.created}`).join('\n');
fs.writeFileSync(
  path.join(designsDir, 'RENAME_MAPPING.md'),
  '# Rename mapping\n\n' + mapOut + '\n',
  'utf8',
);

console.log(
  'Done. Created',
  mapping.length,
  'canonical files and archived originals to',
  archiveDir,
);
console.log('Mapping written to memory/designs/RENAME_MAPPING.md');
