import { build as esbuild } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function rimraf(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

async function readIfExists(file) {
  try { return await fs.readFile(file, 'utf8'); } catch { return undefined; }
}

async function concatCss(fromDir, outFile) {
  let combined = '';
  try {
    const entries = await fs.readdir(fromDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.css')).map(e => e.name).sort();
    for (const name of files) {
      const css = await fs.readFile(path.join(fromDir, name), 'utf8');
      combined += css + '\n';
    }
  } catch {}
  await fs.writeFile(outFile, combined, 'utf8');
}

async function copyDir(srcDir, dstDir) {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await ensureDir(dstDir);
    for (const e of entries) {
      const s = path.join(srcDir, e.name);
      const d = path.join(dstDir, e.name);
      if (e.isDirectory()) await copyDir(s, d);
      else if (e.isFile()) await fs.copyFile(s, d);
    }
  } catch {}
}

function rewriteHtmlReferences(html, { cssHref, jsSrc }) {
  let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/i, `<link rel="stylesheet" href="${cssHref}">`);
  out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i, `<script type="module" src="${jsSrc}"><\/script>`);
  return out;
}

export async function build({ outDir = path.join(repoRoot, 'dist') } = {}) {
  const srcDir = path.join(repoRoot, 'src');
  const uiHtmlPath = path.join(srcDir, 'ui.html');
  const stylesDir = path.join(srcDir, 'styles');
  const assetsDir = path.join(srcDir, 'assets');
  const publicDir = path.join(repoRoot, 'public');

  await rimraf(outDir);
  await ensureDir(outDir);

  const result = await esbuild({
    entryPoints: {
      bundled: path.join(srcDir, 'main.ts'),
      simWorker: path.join(srcDir, 'simWorker.ts'),
    },
    outdir: outDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    sourcemap: false,
    splitting: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
  });

  const cssOut = path.join(outDir, 'bundled.css');
  await concatCss(stylesDir, cssOut);

  await copyDir(assetsDir, path.join(outDir, 'assets'));
  await copyDir(publicDir, outDir);

  // Also output a .ts-named copy of the main bundle if requested by consumers.
  const mainJsPath = path.join(outDir, 'bundled.js');
  const mainTsPath = path.join(outDir, 'bundled.ts');
  try {
    const jsCode = await fs.readFile(mainJsPath, 'utf8');
    await fs.writeFile(mainTsPath, jsCode, 'utf8');
  } catch {}

  const uiHtml = (await readIfExists(uiHtmlPath)) || '<!doctype html><html><head></head><body></body></html>';
  const htmlOut = rewriteHtmlReferences(uiHtml, { cssHref: './bundled.css', jsSrc: './bundled.ts' });
  const namedHtmlOut = path.join(outDir, 'spaceautobattler.html');
  await fs.writeFile(namedHtmlOut, htmlOut, 'utf8');

  return {
    outDir,
    files: {
      html: namedHtmlOut,
      js: mainTsPath,
      worker: path.join(outDir, 'simWorker.js'),
      css: cssOut,
    },
    metafile: result?.metafile,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(repoRoot, 'dist');
  build({ outDir }).then(o => {
    console.log(`Built to ${o.outDir}`);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
