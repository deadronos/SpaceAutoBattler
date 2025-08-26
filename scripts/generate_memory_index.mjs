import fs from 'fs/promises';
import path from 'path';

// Use current working directory as repository root (safer on Windows)
const repoRoot = process.cwd();
const snapshotPath = path.join(repoRoot, 'docs', 'memory_snapshot.json');
const outPath = path.join(repoRoot, 'docs', 'memory_index.md');

async function loadSnapshot() {
  const txt = await fs.readFile(snapshotPath, 'utf8');
  return JSON.parse(txt);
}

function renderNode(node) {
  let s = `### ${node.name}\n\n`;
  if (node.source) s += `- Source: \`${node.source}\`\n\n`;
  if (node.summary) s += `- Summary: ${node.summary}\n\n`;
  return s;
}

async function main() {
  const snap = await loadSnapshot();
  const header = `# Memory index — SpaceAutoBattler\n\nThis file is an exported snapshot of the agent's internal memory observations for the repository. Generated from docs/memory_snapshot.json.\n\n`;
  let body = '## Nodes exported\n\n';
  for (const node of snap.nodes) {
    body += renderNode(node);
  }
  body += `---\n\nLast updated by generator on ${new Date().toISOString()}\n`;
  await fs.writeFile(outPath, header + body, 'utf8');
  console.log('Wrote', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
