#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { PNG } from 'pngjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function usage() {
  console.log(
    `Usage: node scripts/tools/texture-atlas.mjs --input <glob> --output <png> --meta <json> [--padding <n>]`,
  );
}

function nextPow2(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

async function main() {
  const args = parseArgs(process.argv);
  const input = args.input;
  const output = args.output;
  const meta = args.meta;
  const padding = Number.isFinite(Number(args.padding)) ? Number(args.padding) : 2;

  if (!input || !output || !meta) {
    usage();
    process.exitCode = 1;
    return;
  }

  const files = await glob(input, { nodir: true });
  if (!files.length) {
    console.error(`[texture-atlas] No files matched pattern ${input}`);
    process.exitCode = 1;
    return;
  }

  const images = [];
  let totalArea = 0;
  for (const file of files) {
    const buffer = await fs.readFile(file);
    const png = PNG.sync.read(buffer);
    images.push({
      file,
      png,
      width: png.width,
      height: png.height,
    });
    totalArea += (png.width + padding) * (png.height + padding);
  }

  images.sort((a, b) => b.height - a.height);

  const maxWidthGuess = Math.max(
    Math.ceil(Math.sqrt(totalArea)),
    ...images.map((img) => img.width),
  );
  const atlasWidth = nextPow2(maxWidthGuess);

  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let atlasHeight = 0;
  const placements = [];

  for (const img of images) {
    if (x + img.width > atlasWidth) {
      x = 0;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }

    placements.push({ file: img.file, x, y, width: img.width, height: img.height, png: img.png });

    x += img.width + padding;
    shelfHeight = Math.max(shelfHeight, img.height);
    atlasHeight = Math.max(atlasHeight, y + img.height);
  }

  atlasHeight = nextPow2(atlasHeight);

  const atlasPng = new PNG({ width: atlasWidth, height: atlasHeight });
  const regions = {};

  for (const placement of placements) {
    PNG.bitblt(
      placement.png,
      atlasPng,
      0,
      0,
      placement.width,
      placement.height,
      placement.x,
      placement.y,
    );
    const key = path.relative(process.cwd(), placement.file).replace(/\\/g, '/');
    regions[key] = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, PNG.sync.write(atlasPng));

  const metadata = {
    width: atlasWidth,
    height: atlasHeight,
    padding,
    regions,
  };
  await fs.mkdir(path.dirname(meta), { recursive: true });
  await fs.writeFile(meta, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    `[texture-atlas] Wrote atlas ${output} (${atlasWidth}x${atlasHeight}) for ${files.length} textures.`,
  );
}

main().catch((error) => {
  console.error('[texture-atlas] Failed:', error);
  process.exitCode = 1;
});
