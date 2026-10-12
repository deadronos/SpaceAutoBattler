#!/usr/bin/env node
/**
 * Build-time encoder for the ship-hull glTF assets (issue #649, part 2).
 *
 * This script wraps `@gltf-transform/cli` (a pinned devDependency) to shrink the
 * `src/assets/gltf/*.glb` models with geometry compression and/or WebP textures.
 * It never touches `src/` unless you explicitly pass `--in-place`, and it always
 * reports a before/after byte table so "measurably smaller" can be verified.
 *
 * Usage:
 *   node scripts/assets/compress-gltf.mjs --check                 # safe dry-run (defaults)
 *   node scripts/assets/compress-gltf.mjs --check --texture none  # geometry only
 *   node scripts/assets/compress-gltf.mjs --in-place              # write into src/ (after sign-off)
 *   node scripts/assets/compress-gltf.mjs --restore               # git checkout originals
 *
 * Options:
 *   --compress <draco|meshopt|quantize|none>  Geometry compression (default: draco).
 *   --texture  <webp|ktx2|none>               Texture compression (default: webp).
 *   --check                                   Dry-run + fail if the total is not reduced.
 *   --in-place                                Write results back into src/assets/gltf/.
 *   --restore                                 Restore originals with `git checkout`.
 *
 * Pipeline order (textures first, then geometry) matters: `gltf-transform` decodes
 * KHR_draco_mesh_compression on read and does not re-apply it on write, so running
 * geometry first and textures second would silently drop the Draco payload. Applying
 * textures first and geometry last keeps both extensions (verified: fighter lands at
 * ~45.3 KB with EXT_texture_webp + KHR_draco_mesh_compression, versus ~73.8 KB if the
 * order is reversed).
 *
 * Why two explicit commands instead of `gltf-transform optimize`? The `optimize`
 * command bundles destructive scene-graph edits (flatten/join/weld/simplify/palette/
 * instance/prune) that would rename or merge nodes and invalidate the `ship-hulls`
 * scene-structure assertions. If you ever want it, disable every destructive step:
 *   gltf-transform optimize <in> <out> --compress draco --texture-compress webp \
 *     --flatten false --join false --palette false --simplify false --weld false \
 *     --instance false --prune-attributes false
 * The default pipeline here keeps the scene graph, node/mesh names, and materials intact.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const assetsDir = path.join(repoRoot, 'src', 'assets', 'gltf');
const cliPath = path.join(repoRoot, 'node_modules', '.bin', 'gltf-transform');

const GEOMETRY_COMMANDS = new Set(['draco', 'meshopt', 'quantize', 'none']);
const TEXTURE_COMMANDS = new Set(['webp', 'ktx2', 'none']);
// `--texture ktx2` maps to the ETC1S Basis bitstream (smaller); swap to `uastc`
// for higher quality at a larger size. Both require KTX-Software's `ktx`.
const KTX2_COMMAND = 'etc1s';
const KTX_SOFTWARE_MIN = '4.3';

const USAGE = `Usage: node scripts/assets/compress-gltf.mjs [options]

  --compress <draco|meshopt|quantize|none>  Geometry compression (default: draco)
  --texture  <webp|ktx2|none>               Texture compression (default: webp)
  --check                                   Dry-run; exit non-zero if not smaller
  --in-place                                Write results back into src/assets/gltf/
  --restore                                 Restore originals with git checkout
  -h, --help                                Show this help`;

function fail(message) {
  console.error(`compress-gltf: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    compress: 'draco',
    texture: 'webp',
    check: false,
    inPlace: false,
    restore: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--compress') {
      options.compress = argv[i + 1];
      i += 1;
    } else if (arg === '--texture') {
      options.texture = argv[i + 1];
      i += 1;
    } else if (arg === '--check') {
      options.check = true;
    } else if (arg === '--in-place') {
      options.inPlace = true;
    } else if (arg === '--restore') {
      options.restore = true;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      fail(`unknown argument: ${arg}\n\n${USAGE}`);
    }
  }

  return options;
}

function formatBytes(bytes) {
  return bytes.toLocaleString('en-US');
}

function formatPercent(delta, before) {
  if (before === 0) return 'n/a';
  const percent = (delta / before) * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

function printReport(rows) {
  const header = ['Asset', 'Before (B)', 'After (B)', 'Delta (B)', 'Delta (%)'];
  const widths = [14, 12, 12, 12, 10];
  const line = (cells) =>
    cells
      .map((cell, index) => String(cell).padEnd(widths[index]))
      .join('  ')
      .trimEnd();

  console.log('');
  console.log(line(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));

  let totalBefore = 0;
  let totalAfter = 0;
  for (const row of rows) {
    totalBefore += row.before;
    totalAfter += row.after;
    const delta = row.after - row.before;
    console.log(
      line([
        row.file,
        formatBytes(row.before),
        formatBytes(row.after),
        formatBytes(delta),
        formatPercent(delta, row.before),
      ]),
    );
  }

  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  const totalDelta = totalAfter - totalBefore;
  console.log(
    line([
      'TOTAL',
      formatBytes(totalBefore),
      formatBytes(totalAfter),
      formatBytes(totalDelta),
      formatPercent(totalDelta, totalBefore),
    ]),
  );
  console.log('');

  return { totalBefore, totalAfter };
}

function runGltfTransform(args) {
  const result = spawnSync(cliPath, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) {
    throw new Error(`failed to run gltf-transform: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`gltf-transform ${args[0]} exited with code ${result.status}`);
  }
}

function runRestore() {
  console.log('compress-gltf: restoring originals from git...');
  const result = spawnSync('git', ['checkout', '--', path.join('src', 'assets', 'gltf')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.error) fail(`failed to run git: ${result.error.message}`);
  if (result.status !== 0) fail(`git checkout exited with code ${result.status}`);
  console.log('compress-gltf: src/assets/gltf restored to the committed (uncompressed) state.');
}

function ensureCliAvailable() {
  if (existsSync(cliPath)) return;
  console.error('compress-gltf: could not find node_modules/.bin/gltf-transform.');
  console.error('The encoder is not installed. Install it with:');
  console.error('');
  console.error('  pnpm install');
  console.error('');
  console.error('If that does not help, add the pinned devDependency explicitly:');
  console.error('');
  console.error('  pnpm add -D @gltf-transform/cli@4.5.1');
  process.exit(1);
}

function ensureKtxAvailable() {
  const probe = spawnSync('sh', ['-c', 'command -v ktx'], { stdio: 'ignore' });
  if (probe.status === 0) return;
  console.error(
    'compress-gltf: --texture ktx2 requires KTX-Software (`ktx`), which was not found.',
  );
  console.error('');
  console.error(
    `Install KTX-Software >=${KTX_SOFTWARE_MIN} and make sure \`ktx\` is on your PATH:`,
  );
  console.error('  https://github.com/KhronosGroup/KTX-Software/releases');
  console.error('  macOS: brew install ktx-software   (then reopen your shell)');
  console.error('');
  console.error('No files were written.');
  process.exit(1);
}

function listAssets() {
  if (!existsSync(assetsDir)) fail(`asset directory not found: ${assetsDir}`);
  const files = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.glb'))
    .sort();
  if (files.length === 0) fail(`no .glb files found in ${assetsDir}`);
  return files;
}

function compressAssets(options) {
  const files = listAssets();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'gltf-compress-'));
  const rows = [];

  try {
    for (const file of files) {
      const input = path.join(assetsDir, file);
      const before = statSync(input).size;
      let current = input;

      // Textures first: a later pass would decode (and drop) KHR_draco_mesh_compression.
      if (options.texture !== 'none') {
        const textureOut = path.join(tempDir, `${file}.texture.glb`);
        const command = options.texture === 'ktx2' ? KTX2_COMMAND : options.texture;
        runGltfTransform([command, current, textureOut]);
        current = textureOut;
      }

      // Geometry last so the Draco/Meshopt payload survives the write.
      if (options.compress !== 'none') {
        const geometryOut = path.join(tempDir, `${file}.geometry.glb`);
        runGltfTransform([options.compress, current, geometryOut]);
        current = geometryOut;
      }

      rows.push({ file, input, output: current, before, after: statSync(current).size });
    }

    const { totalBefore, totalAfter } = printReport(rows);

    if (options.inPlace) {
      for (const row of rows) {
        if (row.output !== row.input) copyFileSync(row.output, row.input);
      }
      console.log(`compress-gltf: wrote ${rows.length} file(s) into src/assets/gltf/.`);
      console.log(
        'compress-gltf: run `pnpm run test:playwright:ship` and review pixels before committing.',
      );
    } else {
      console.log('compress-gltf: dry run — nothing in src/ was modified.');
      if (totalAfter >= totalBefore) {
        console.log('compress-gltf: WARNING — the total did not shrink.');
      }
    }

    if (options.check && totalAfter >= totalBefore) {
      console.error(
        'compress-gltf: --check failed: total compressed size is not smaller than the originals.',
      );
      process.exitCode = 1;
    }
  } catch (error) {
    // No partial `--in-place` writes: copies only happen after every file succeeds.
    console.error(`compress-gltf: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return;
  }

  if (options.restore) {
    runRestore();
    return;
  }

  if (!GEOMETRY_COMMANDS.has(options.compress)) {
    fail(`invalid --compress value "${options.compress}" (expected draco|meshopt|quantize|none)`);
  }
  if (!TEXTURE_COMMANDS.has(options.texture)) {
    fail(`invalid --texture value "${options.texture}" (expected webp|ktx2|none)`);
  }
  if (options.check && options.inPlace) {
    fail('--check and --in-place are mutually exclusive.');
  }

  if (options.texture === 'ktx2') ensureKtxAvailable();
  ensureCliAvailable();
  compressAssets(options);
}

main();
