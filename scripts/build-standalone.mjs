import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import shared build utilities
import { build } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const BUILD_CONFIG = {
  srcDir: path.join(repoRoot, 'src'),
  svgConfigDir: path.join(repoRoot, 'src', 'config', 'assets', 'svg'),
  defaultOutDir: path.join(repoRoot, 'dist'),
  minify: process.env.NODE_ENV === 'production',
  svgFiles: ['fighter.svg', 'corvette.svg', 'frigate.svg', 'destroyer.svg', 'carrier.svg'],
  maxConcurrency: 4,
};

class StandaloneBuildLogger {
  constructor(prefix = 'STANDALONE') {
    this.prefix = prefix;
    this.startTime = Date.now();
    this.steps = new Map();
    this.errors = [];
    this.warnings = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().slice(11, 23);
    const formatted = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
      this.errors.push(message);
      console.error(`\x1b[31m${formatted}\x1b[0m`);
    } else if (level === 'warn') {
      this.warnings.push(message);
      console.warn(`\x1b[33m${formatted}\x1b[0m`);
    } else if (level === 'success') {
      console.log(`\x1b[32m${formatted}\x1b[0m`);
    } else {
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
    const summary = { duration: `${totalTime}ms`, errors: this.errors.length, warnings: this.warnings.length };
    this.log(`Build completed in ${summary.duration} (Errors: ${summary.errors}, Warnings: ${summary.warnings})`);
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

function inlineHtml({ html, css, js, workerJs, svgAssets }) {
  // Inline CSS into a <style> tag
  let out = html.replace(/<link[^>]+href=["'][^"']+["'][^>]*>/i, `<style>\n${css}\n</style>`);

  // Create a simpler inline script that avoids complex string embedding
  const inlineScript = `
(function(){
  // Embed SVG assets
  if (typeof globalThis !== 'undefined') {
    globalThis.__INLINE_SVG_ASSETS = ${JSON.stringify(svgAssets)};
  }

  // Embed worker script as a function that returns the code
  const getWorkerScript = function() {
    return ${JSON.stringify(workerJs)};
  };

  // Override Worker constructor to use embedded script
  const OriginalWorker = window.Worker;
  window.Worker = class extends OriginalWorker {
    constructor(url, opts) {
      if (typeof url === 'string' && url.includes('simWorker.js')) {
        const workerCode = getWorkerScript();
        const blob = new Blob([workerCode], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        super(blobUrl, { type: 'module', ...(opts || {}) });
        return;
      }
      super(url, opts);
    }
  };

  // Execute main script directly
  ${js}
})();`;

  // Replace the script tag with our inline version
  out = out.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/i, `<script type="module">${inlineScript}</script>`);

  return out;
}

async function loadSvgAssets(svgDir, svgFiles, logger) {
  logger.time('Load SVG Assets');
  const svgAssets = {};
  for (const fname of svgFiles) {
    const fpath = path.join(svgDir, fname);
    try {
      svgAssets[fname.replace('.svg', '')] = await fs.readFile(fpath, 'utf8');
      logger.log(`Loaded SVG asset: ${fname}`);
    } catch (err) {
      logger.log(`SVG asset missing: ${fpath}`, 'warn');
      svgAssets[fname.replace('.svg', '')] = '';
    }
  }
  logger.timeEnd('Load SVG Assets');
  return svgAssets;
}

export async function buildStandalone({ outDir = BUILD_CONFIG.defaultOutDir, incremental = false } = {}) {
  const logger = new StandaloneBuildLogger('STANDALONE');
  logger.log(`Starting standalone build to ${path.relative(repoRoot, outDir)}`);

  try {
    logger.time('Base build');
    const baseResult = await build({ outDir, incremental });
    logger.timeEnd('Base build');

    logger.time('Asset loading');
    const [html, css, js, workerJs] = await Promise.all([
      fs.readFile(baseResult.files.html, 'utf8'),
      fs.readFile(baseResult.files.css, 'utf8'),
      fs.readFile(baseResult.files.js, 'utf8'),
      fs.readFile(baseResult.files.worker, 'utf8'),
    ]);
    logger.timeEnd('Asset loading');

    const svgAssets = await loadSvgAssets(BUILD_CONFIG.svgConfigDir, BUILD_CONFIG.svgFiles, logger);

    logger.time('HTML inlining');
    const final = inlineHtml({ html, css, js, workerJs, svgAssets });
    logger.timeEnd('HTML inlining');

    logger.time('File writing');
    await fs.mkdir(outDir, { recursive: true });
    const standalonePath = path.join(outDir, 'spaceautobattler_standalone.html');
    await fs.writeFile(standalonePath, final, 'utf8');
    logger.timeEnd('File writing');

    const standaloneSize = await getFileSize(standalonePath);
    logger.log(`Standalone output: ${formatBytes(standaloneSize)}`);

    const summary = logger.summary();

    return {
      outDir,
      files: { ...baseResult.files, standalone: standalonePath },
      summary,
      outputSize: standaloneSize,
    };
  } catch (error) {
    logger.log(`Standalone build failed: ${error.message}`, 'error');
    throw error;
  }
}

// If run directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : BUILD_CONFIG.defaultOutDir;
  const incremental = process.argv.includes('--incremental') || process.argv.includes('-i');
  buildStandalone({ outDir, incremental })
    .then((result) => {
      console.log(`Standalone build successful: ${result.files.standalone}`);
    })
    .catch((err) => {
      console.error('Standalone build failed:', err.message);
      process.exit(1);
    });
}

