#!/usr/bin/env node
// Minimal memory regeneration helper for SpaceAutoBattler
// Usage: node ./scripts/generate_memories.mjs

import fs from 'fs/promises';
import path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'src');
const memoryDir = path.join(repoRoot, 'memory');

// Files to scan and memory name mapping (conservative list)
const scanTargets = [
  { file: 'core/gameState.ts', memories: ['game_state_api'] },
  { file: 'core/aiController.ts', memories: ['ai_controller_api'] },
  { file: 'core/physics.ts', memories: ['physics_api'] },
  { file: 'core/searchUtils.ts', memories: ['search_utils_api'] },
  { file: 'core/spatialIndex.ts', memories: ['spatial_index_api'] },
  { file: 'core/assetLoader.ts', memories: ['asset_loader_api'] },
  { file: 'core/svgLoader.ts', memories: ['svg_loader_api'] },
  { file: 'simWorker.ts', memories: ['sim_worker_api'] },
  { file: 'renderer/threeRenderer.ts', memories: ['three_renderer_api'] },
  // add more target mappings as needed
];

async function extractLeadingComments(fileContent) {
  // Very simple: find the first block comment /** ... */ or // -style leading lines
  const m = fileContent.match(/\/\*\*[\s\S]*?\*\//);
  if (m) return m[0];
  // fallback: grab top 20 lines of file as stub
  return fileContent.split('\n').slice(0, 20).join('\n');
}

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch (e) { }
}

async function main() {
  await ensureDir(memoryDir);
  for (const t of scanTargets) {
    try {
      const p = path.join(srcDir, t.file);
      const content = await fs.readFile(p, 'utf8');
      const leading = await extractLeadingComments(content);
      for (const mem of t.memories) {
        const out = [
          '# ' + mem,
          '',
          '```',
          leading,
          '```',
          '',
          '> Auto-generated stub — please review and expand.'
        ].join("\n");
        const outPath = path.join(memoryDir, mem + '.md');
        await fs.writeFile(outPath, out, 'utf8');
        console.log('Wrote', outPath);
      }
    } catch (e) {
      console.warn('Skipping', t.file, e.message);
    }
  }
  console.log('Done. Review files in memory/ and merge manually.');
}

main().catch(err => { console.error(err); process.exit(1); });
