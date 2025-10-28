const fs = require('fs');
const path = require('path');
const tasksDir = path.join(__dirname, '..', 'memory', 'tasks');

function slugFromFilename(fname) {
  const m = fname.match(/^TASK\d{3}-(.+)\.md$/i);
  if (!m) return fname.replace(/\.md$/,'');
  return m[1];
}

let files = fs.readdirSync(tasksDir).filter(f => /^TASK\d{3}-.+\.md$/i.test(f));

// get mtime for each and sort by mtime ascending (oldest first)
files = files.map(f => {
  const p = path.join(tasksDir, f);
  const st = fs.statSync(p);
  return { name: f, mtime: st.mtimeMs };
}).sort((a,b)=> a.mtime - b.mtime);

const mapping = [];
let idx = 1;
for (const entry of files) {
  const f = entry.name;
  const slug = slugFromFilename(f);
  const newNameBase = `TASK${String(idx).padStart(3,'0')}-${slug}`;
  const newName = `${newNameBase}.md`;
  const oldPath = path.join(tasksDir, f);
  const newPath = path.join(tasksDir, newName);

  if (f === newName) {
    mapping.push({from: f, to: newName, action: 'unchanged'});
  } else {
    let finalNewName = newName;
    let finalNewPath = newPath;
    if (fs.existsSync(finalNewPath)) {
      let k = 1;
      do {
        finalNewName = `${newNameBase}-r${k}.md`;
        finalNewPath = path.join(tasksDir, finalNewName);
        k++;
      } while (fs.existsSync(finalNewPath));
    }
    fs.renameSync(oldPath, finalNewPath);
    mapping.push({from: f, to: finalNewName, action: 'renamed', mtime: entry.mtime});
  }
  idx++;
}

const mapFile = path.join(tasksDir, 'RENAME_MAPPING.md');
let mapContent = '';
if (fs.existsSync(mapFile)) mapContent = fs.readFileSync(mapFile,'utf8');
mapContent += '\n\n# Renumbering by mtime (oldest-first; highest number will be newest)\n\n';
mapContent += mapping.map(m => `- ${m.from} -> ${m.to} (${m.action})`).join('\n');
fs.writeFileSync(mapFile, mapContent,'utf8');
console.log('Renumber-tasks-by-mtime-oldest complete:', mapping.length, 'files processed');
console.log('Updated memory/tasks/RENAME_MAPPING.md with renumbering-by-mtime-oldest section');
