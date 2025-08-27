import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pure TypeScript build: all runtime logic is sourced from /src/*.ts files.
// No JS shims or transpilation steps are required.
import { build as runBaseBuild } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Build configuration and utilities
class StandaloneBuildLogger {
  constructor() {
    this.startTime = Date.now();
    this.steps = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [STANDALONE] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  time(label) {
    this.steps.push({ label, start: Date.now() });
    this.log(`Starting: ${label}`);
  }

  timeEnd(label) {
    const step = this.steps.find(s => s.label === label);
    if (step) {
      const duration = Date.now() - step.start;
      this.log(`Completed: ${label} (${duration}ms)`);
      this.steps = this.steps.filter(s => s.label !== label);
    }
  }

  summary() {
    const totalTime = Date.now() - this.startTime;
    this.log(`Standalone build completed in ${totalTime}ms`);
  }
}

async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// No longer needed: escapeHtml (unused)

function inlineHtml({ html, css, js, workerJs }) {
    // Inject CSS inside a <style> tag
    let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/i, () => `<style>\n${css}\n</style>`);


    // Replace module script src with inline code after adding a worker loader shim.
    // Monkey-patch Worker to handle URL('./simWorker.js', import.meta.url) by serving from an inline blob.
    const workerLoader = `
        const __workerCode = ${JSON.stringify(workerJs)};
        const __workerBlob = new Blob([__workerCode], { type: 'text/javascript' });
        const __workerUrl = URL.createObjectURL(__workerBlob);
        const __OrigWorker = window.Worker;
        window.Worker = class extends __OrigWorker {
            constructor(url, opts) {
                try {
                    const s = typeof url === 'string' ? url : String(url);
                    if (s.endsWith('simWorker.js')) {
                        super(__workerUrl, { type: 'module', ...(opts||{}) });
                        return;
                    }
                } catch {}
                super(url, opts);
            }
        };
    `;

    const jsInline = `${workerLoader}\n${js}`;
    out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i, () => `<script type="module">\n${jsInline}\n<\/script>`);
    return out;
}


async function buildStandalone() {
  const logger = new StandaloneBuildLogger();
  logger.log('Starting standalone build');

  try {
    logger.time('Base build');
    // All logic is bundled from TypeScript sources.
    const { outDir, files } = await runBaseBuild({ outDir: path.join(repoRoot, 'dist') });
    logger.timeEnd('Base build');

    logger.time('Asset loading');
    const [html, css, js, workerJs] = await Promise.all([
      fs.readFile(files.html, 'utf8'),
      fs.readFile(files.css, 'utf8'),
      fs.readFile(files.js, 'utf8'),
      fs.readFile(files.worker, 'utf8'),
    ]);
    logger.timeEnd('Asset loading');

    // Log input file sizes
    logger.log(`Input sizes: HTML=${formatBytes(html.length)}, CSS=${formatBytes(css.length)}, JS=${formatBytes(js.length)}, Worker=${formatBytes(workerJs.length)}`);

    logger.time('SVG asset processing');
    // Inline SVG assets
    const svgDir = path.join(repoRoot, 'src', 'config', 'assets', 'svg');
    const svgFiles = ['destroyer.svg', 'carrier.svg', 'frigate.svg', 'corvette.svg'];
    const svgAssets = {};

    for (const fname of svgFiles) {
      const fpath = path.join(svgDir, fname);
      try {
        svgAssets[fname.replace('.svg', '')] = await fs.readFile(fpath, 'utf8');
        logger.log(`Loaded SVG asset: ${fname}`);
      } catch (error) {
        logger.log(`SVG asset missing: ${fpath}`, 'warn');
        svgAssets[fname.replace('.svg', '')] = '';
      }
    }
    logger.timeEnd('SVG asset processing');

    logger.time('HTML inlining');
    // Create a dedicated inline <script> that assigns the inlined SVG assets.
    // IMPORTANT: This must execute BEFORE the main module script so that
    // AssetsConfig.ts can read globalThis.__INLINE_SVG_ASSETS during module
    // evaluation and populate AssetsConfig.svgAssets with inline strings.
    const inlineSvgScript = `<script>(function(){try{if(typeof globalThis!=='undefined'){globalThis.__INLINE_SVG_ASSETS=${JSON.stringify(svgAssets)};}}catch(e){}})();</script>`;

    // Produce the inlined HTML normally
    let inlined = inlineHtml({ html, css, js, workerJs });

    // Place the inlineSvgScript right after the opening <body> tag so it
    // runs before any subsequent <script type="module"> content.
    inlined = inlined.replace(/<body(\s[^>]*)?>/, (m) => `${m}\n${inlineSvgScript}`);

    // Fallback: if no <body> tag was found (unlikely), append at top.
    let final = inlined.includes('<body') ? inlined : (inlineSvgScript + '\n' + inlined);
    logger.timeEnd('HTML inlining');

    logger.time('File writing');
    const standalonePath = path.join(outDir, 'spaceautobattler_standalone.html');
    await fs.writeFile(standalonePath, final, 'utf8');
    logger.timeEnd('File writing');

    const standaloneSize = await getFileSize(standalonePath);
    logger.log(`Standalone output: ${formatBytes(standaloneSize)}`);

    logger.time('Validation');
    // Post-write verification: ensure the standalone contains the injection and at least one expected asset key
    try {
      const written = await fs.readFile(standalonePath, 'utf8');

      const hasInlineAssets = written.includes('__INLINE_SVG_ASSETS');
      const hasFrigateAsset = written.includes('"frigate"');
      const hasSvgScript = written.includes('<script>') && written.includes('__INLINE_SVG_ASSETS');

      if (!hasInlineAssets) {
        throw new Error('__INLINE_SVG_ASSETS not found in generated standalone HTML');
      }

      if (!hasFrigateAsset) {
        throw new Error('Expected asset key "frigate" not found in generated standalone HTML');
      }

      if (!hasSvgScript) {
        throw new Error('Inline SVG script not properly injected');
      }

      logger.log('✓ Validation passed: inline SVG assets present and properly injected');
    } catch (error) {
      logger.log(`✗ Validation failed: ${error.message}`, 'error');
      throw error;
    }
    logger.timeEnd('Validation');

    logger.summary();
    console.log(`✓ Standalone build successful: ${standalonePath}`);

  } catch (error) {
    logger.log(`Standalone build failed: ${error.message}`, 'error');
    throw error;
  }
}


// Execute when run directly via `node scripts/build-standalone.mjs`
// This script now builds exclusively from TypeScript sources in /src.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildStandalone().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

