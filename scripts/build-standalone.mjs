import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import shared build utilities
import { build as runBaseBuild } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Build configuration - centralized and overridable
const BUILD_CONFIG = {
  // Source directories
  srcDir: path.join(repoRoot, 'src'),
  svgConfigDir: path.join(repoRoot, 'src', 'config', 'assets', 'svg'),

  // Output settings
  defaultOutDir: path.join(repoRoot, 'dist'),
  minify: process.env.NODE_ENV === 'production',

  // Asset settings
  svgFiles: ['fighter.svg', 'corvette.svg', 'frigate.svg', 'destroyer.svg', 'carrier.svg'],

  // Performance settings
  maxConcurrency: 4,
};

// Shared build utilities (imported from build.mjs)
class StandaloneBuildLogger {
  constructor(prefix = 'STANDALONE') {
    this.prefix = prefix;
    this.startTime = Date.now();
    this.steps = new Map();
    this.errors = [];
    this.warnings = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const formatted = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'error':
        this.errors.push(message);
        console.error(`\x1b[31m${formatted}\x1b[0m`);
        break;
      case 'warn':
        this.warnings.push(message);
        console.warn(`\x1b[33m${formatted}\x1b[0m`);
        break;
      case 'success':
        console.log(`\x1b[32m${formatted}\x1b[0m`);
        break;
      default:
        console.log(formatted);
    }
  }

  time(label) {
    this.steps.set(label, Date.now());
    this.log(`Starting: ${label}`);
  }

  timeEnd(label) {
    const start = this.steps.get(label);
    if (start) {
      const duration = Date.now() - start;
      this.log(`Completed: ${label} (${duration}ms)`);
      this.steps.delete(label);
    }
  }

  summary() {
    const totalTime = Date.now() - this.startTime;
    const summary = {
      duration: `${totalTime}ms`,
      errors: this.errors.length,
      warnings: this.warnings.length,
    };

    this.log(`Build completed in ${summary.duration} (Errors: ${summary.errors}, Warnings: ${summary.warnings})`);

    if (this.errors.length > 0) {
      this.log('Errors encountered:', 'error');
      this.errors.forEach(err => this.log(`  - ${err}`, 'error'));
    }

    return summary;
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

// Optimized HTML inlining with asset processing
function inlineHtml({ html, css, js, workerJs, svgAssets }) {
  // Inject CSS inside a <style> tag
  let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, () => `<style>\n${css}\n</style>`);

  // Create worker loader shim for inline worker code
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

  // Inline JavaScript with worker loader
  const jsInline = `${workerLoader}\n${js}`;
  out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, () => `<script type="module">\n${jsInline}\n</script>`);

  return out;
}

// Create inline SVG script for asset injection
function createSvgInlineScript(svgAssets) {
  return `<script>(function(){try{if(typeof globalThis!=='undefined'){globalThis.__INLINE_SVG_ASSETS=${JSON.stringify(svgAssets)};}}catch(e){}})();</script>`;
}

// Optimized SVG asset loading with parallel processing
async function loadSvgAssets(svgDir, svgFiles, logger) {
  logger.time('Load SVG Assets');

  const svgAssets = {};

  // Process SVG files in parallel with concurrency limit
  const concurrencyLimit = BUILD_CONFIG.maxConcurrency;
  for (let i = 0; i < svgFiles.length; i += concurrencyLimit) {
    const batch = svgFiles.slice(i, i + concurrencyLimit);
    await Promise.all(batch.map(async (fname) => {
      const fpath = path.join(svgDir, fname);
      try {
        svgAssets[fname.replace('.svg', '')] = await fs.readFile(fpath, 'utf8');
        logger.log(`Loaded SVG asset: ${fname}`);
      } catch (error) {
        logger.log(`SVG asset missing: ${fpath}`, 'warn');
        svgAssets[fname.replace('.svg', '')] = '';
      }
    }));
  }

  logger.timeEnd('Load SVG Assets');
  return svgAssets;
}

// Minify HTML content if enabled
function minifyHtml(html, minify = false) {
  if (!minify) return html;

  // Basic HTML minification - remove unnecessary whitespace
  return html
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .replace(/>\s+</g, '><')  // Remove whitespace between tags
    .replace(/\s*([<>])\s*/g, '$1')  // Remove whitespace around < and >
    .trim();
}

export async function buildStandalone({ outDir = BUILD_CONFIG.defaultOutDir, incremental = false } = {}) {
  const logger = new StandaloneBuildLogger('STANDALONE');
  logger.log(`Starting standalone build to ${path.relative(repoRoot, outDir)}`);

  try {
    logger.time('Base build');
    const baseResult = await runBaseBuild({ outDir, incremental });
    logger.timeEnd('Base build');

    logger.time('Asset loading');
    const [html, css, js, workerJs] = await Promise.all([
      fs.readFile(baseResult.files.html, 'utf8'),
      fs.readFile(baseResult.files.css, 'utf8'),
      fs.readFile(baseResult.files.js, 'utf8'),
      fs.readFile(baseResult.files.worker, 'utf8'),
    ]);
    logger.timeEnd('Asset loading');

    // Log input file sizes
    const inputSizes = {
      html: html.length,
      css: css.length,
      js: js.length,
      worker: workerJs.length
    };
    logger.log(`Input sizes: HTML=${formatBytes(inputSizes.html)}, CSS=${formatBytes(inputSizes.css)}, JS=${formatBytes(inputSizes.js)}, Worker=${formatBytes(inputSizes.worker)}`);

    // Load SVG assets
    const svgAssets = await loadSvgAssets(BUILD_CONFIG.svgConfigDir, BUILD_CONFIG.svgFiles, logger);

    logger.time('HTML inlining');
    // Create inline SVG script
    const inlineSvgScript = createSvgInlineScript(svgAssets);

    // Inline all assets into HTML
    let inlined = inlineHtml({ html, css, js, workerJs, svgAssets });

    // Inject SVG script right after opening body tag
    inlined = inlined.replace(/<body(\s[^>]*)?>/, (m) => `${m}\n${inlineSvgScript}`);

    // Minify if enabled
    const final = BUILD_CONFIG.minify ? minifyHtml(inlined, true) : inlined;
    logger.timeEnd('HTML inlining');

    logger.time('File writing');
    const standalonePath = path.join(outDir, 'spaceautobattler_standalone.html');
    await fs.writeFile(standalonePath, final, 'utf8');
    logger.timeEnd('File writing');

    const standaloneSize = await getFileSize(standalonePath);
    logger.log(`Standalone output: ${formatBytes(standaloneSize)}`);

    logger.time('Validation');
    // Post-write verification
    try {
      const written = await fs.readFile(standalonePath, 'utf8');

      const validations = [
        { test: written.includes('__INLINE_SVG_ASSETS'), message: '__INLINE_SVG_ASSETS not found' },
        { test: written.includes('"frigate"'), message: 'Expected asset key "frigate" not found' },
        { test: written.includes('<script>') && written.includes('__INLINE_SVG_ASSETS'), message: 'Inline SVG script not properly injected' },
        { test: written.includes('<style>'), message: 'CSS not properly inlined' },
        { test: written.includes('__workerCode'), message: 'Worker code not properly inlined' },
      ];

      const failures = validations.filter(v => !v.test);
      if (failures.length > 0) {
        throw new Error(`Validation failures: ${failures.map(f => f.message).join(', ')}`);
      }

      logger.log('✓ Validation passed: all assets properly inlined and injected');
    } catch (error) {
      logger.log(`✗ Validation failed: ${error.message}`, 'error');
      throw error;
    }
    logger.timeEnd('Validation');

    const summary = logger.summary();

    return {
      outDir,
      files: {
        ...baseResult.files,
        standalone: standalonePath,
      },
      summary,
      inputSizes,
      outputSize: standaloneSize,
    };
  } catch (error) {
    logger.log(`Standalone build failed: ${error.message}`, 'error');
    throw error;
  }
}

// Execute when run directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : BUILD_CONFIG.defaultOutDir;
  const incremental = process.argv.includes('--incremental') || process.argv.includes('-i');

  buildStandalone({ outDir, incremental })
    .then((result) => {
      console.log(`✓ Standalone build successful: ${result.files.standalone}`);
      console.log(`  Input:  HTML=${formatBytes(result.inputSizes.html)}, CSS=${formatBytes(result.inputSizes.css)}, JS=${formatBytes(result.inputSizes.js)}`);
      console.log(`  Output: ${formatBytes(result.outputSize)} (${((result.outputSize / (result.inputSizes.html + result.inputSizes.css + result.inputSizes.js)) * 100).toFixed(1)}% of original)`);
    })
    .catch((error) => {
      console.error('✗ Standalone build failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}