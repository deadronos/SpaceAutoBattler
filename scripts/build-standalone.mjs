#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const ENTRY = path.join(SRC, 'main.js');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

async function build({ watch = false, bundleOnly = false } = {}) {
  ensureDir(DIST);

  const bundleOut = path.join(DIST, 'bundle.js');

  const buildOptions = {
    entryPoints: [ENTRY],
    bundle: true,
    sourcemap: false,
    format: 'esm',
    target: ['es2020'],
    outfile: bundleOut,
    logLevel: 'info',
    platform: 'browser',
  };

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    console.log('Watching for changes...');
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
  }

  if (bundleOnly) {
    console.log('Bundle-only build complete:', bundleOut);
    return;
  }

  // produce index.html referencing the bundle as a module
  const uiHtmlPath = path.join(SRC, 'ui.html');
  let uiHtml = fs.existsSync(uiHtmlPath) ? fs.readFileSync(uiHtmlPath, 'utf8') : null;
  if (!uiHtml) {
    // fallback basic html
    uiHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Space AutoBattler</title><link rel="stylesheet" href="./styles/ui.css"></head><body><canvas id="world"></canvas><script type="module" src="./dist/bundle.js"></script></body></html>`;
  } else {
    // replace existing script tag that loads ./src/main.js to use ./dist/bundle.js
    uiHtml = uiHtml.replace(/<script[^>]*type=["']module["'][^>]*src=["']\.\/src\/main\.js["'][^>]*><\/script>/i, '<script type="module" src="./dist/bundle.js"></script>');
    // ensure stylesheet link points to ./styles/ui.css (add if missing)
    if (!/href=["']\.\/styles\/ui\.css["']/i.test(uiHtml)) {
      uiHtml = uiHtml.replace(/<\/head>/i, '  <link rel="stylesheet" href="./styles/ui.css">\n</head>');
    }
  }

  const indexOut = path.join(DIST, 'index.html');
  // update uiHtml to reference a single bundle.css at dist root
  uiHtml = uiHtml.replace(/href=["']\.\/styles\/ui\.css["']/i, 'href="./bundle.css"');
  fs.writeFileSync(indexOut, uiHtml, 'utf8');
  console.log('Wrote', indexOut);

  // build a single concatenated CSS bundle (dist/bundle.css) from src/styles/*.css
  const stylesSrc = path.join(SRC, 'styles');
  const cssBundleOut = path.join(DIST, 'bundle.css');
  if (fs.existsSync(stylesSrc)) {
    const files = fs.readdirSync(stylesSrc).filter(f => f.endsWith('.css'));
    let cssCombined = '';
    for (const f of files) {
      const s = path.join(stylesSrc, f);
      const content = fs.readFileSync(s, 'utf8');
      cssCombined += `\n/* ${f} */\n` + content + '\n';
    }
    fs.writeFileSync(cssBundleOut, cssCombined, 'utf8');
    console.log('Wrote CSS bundle', cssBundleOut);
  }

  // create standalone inlined HTML
  const bundleCode = fs.readFileSync(bundleOut, 'utf8');
  // make a copy of uiHtml but inline the bundle code into a <script type="module"> ...</script>
  let standaloneHtml = uiHtml.replace(/<script[^>]*type=["']module["'][^>]*src=["']\.\/dist\/bundle\.js["'][^>]*><\/script>/i, `\n<script type="module">\n${bundleCode}\n</script>\n`);
  // inline css if present (dist/bundle.css)
  const distCss = path.join(DIST, 'bundle.css');
  if (fs.existsSync(distCss)) {
    const css = fs.readFileSync(distCss, 'utf8');
    standaloneHtml = standaloneHtml.replace(/<link[^>]*href=["']\.\/bundle\.css["'][^>]*>/i, `<style>\n${css}\n</style>`);
  }
  const standaloneOut = path.join(DIST, 'standalone.html');
  fs.writeFileSync(standaloneOut, standaloneHtml, 'utf8');
  console.log('Wrote', standaloneOut);

  // also copy the standalone file to repo root with the canonical name
  try {
    const canonical = path.join(ROOT, 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');
    fs.copyFileSync(standaloneOut, canonical);
    console.log('Copied standalone to', canonical);
  } catch (err) {
    console.warn('Failed to copy standalone to repo root:', err.message || err);
  }

  console.log('Build complete.');
}

// simple CLI
const args = process.argv.slice(2);
const watch = args.includes('--watch') || args.includes('-w');
const bundleOnly = args.includes('--bundle-only') || args.includes('--bundleonly');
build({ watch, bundleOnly }).catch(err => { console.error(err); process.exit(1); });
