import { build as esbuild } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Build configuration - centralized and overridable
const BUILD_CONFIG = {
  // Source directories
  srcDir: path.join(repoRoot, 'src'),
  stylesDir: path.join(repoRoot, 'src', 'styles'),
  assetsDir: path.join(repoRoot, 'src', 'assets'),
  svgConfigDir: path.join(repoRoot, 'src', 'config', 'assets', 'svg'),
  publicDir: path.join(repoRoot, 'public'),

  // Output settings
  defaultOutDir: path.join(repoRoot, 'dist'),
  sourcemap: process.env.SOURCEMAP !== 'false',
  sourcesContent: process.env.SOURCES_CONTENT !== 'false',
  minify: process.env.NODE_ENV === 'production',

  // Build targets
  target: ['es2022'],
  platform: 'browser',
  format: 'esm',

  // Asset settings
  svgFiles: ['fighter.svg', 'corvette.svg', 'frigate.svg', 'destroyer.svg', 'carrier.svg'],

  // Performance settings
  maxConcurrency: 4,
};

// Shared build utilities
class BuildLogger {
  constructor(prefix = 'BUILD') {
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

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dir}: ${error.message}`);
  }
}

async function rimraf(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors for rimraf - directory might not exist
  }
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Failed to read file ${file}: ${error.message}`);
    }
    return undefined;
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

async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return '';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Optimized CSS bundling with esbuild
async function buildCssBundle({ stylesDir, outFile, sourcemap = true, sourcesContent = true, logger }) {
  logger.time('CSS Bundle');

  try {
    // Find all CSS files recursively
    const cssFiles = await findFiles(stylesDir, '.css');

    if (cssFiles.length === 0) {
      logger.log(`No CSS files found in ${stylesDir}, creating empty bundle`);
      await fs.writeFile(outFile, '', 'utf8');
      if (sourcemap) {
        await fs.writeFile(outFile + '.map', JSON.stringify({
          version: 3,
          sources: [],
          mappings: '',
          names: []
        }), 'utf8');
      }
      logger.timeEnd('CSS Bundle');
      return;
    }

    // Create virtual entry with @import statements
    const imports = cssFiles
      .map(file => path.relative(stylesDir, file))
      .sort()
      .map(relPath => `@import "./${relPath}";`)
      .join('\n');

    logger.log(`Bundling ${cssFiles.length} CSS files`);

    const result = await esbuild({
      stdin: {
        contents: imports,
        sourcefile: 'bundle.css',
        resolveDir: stylesDir,
        loader: 'css',
      },
      bundle: true,
      outfile: outFile,
      sourcemap,
      sourcesContent,
      minify: BUILD_CONFIG.minify,
      logLevel: 'silent',
    });

    const size = await getFileSize(outFile);
    logger.log(`CSS bundle created: ${formatBytes(size)}`);
    logger.timeEnd('CSS Bundle');
    return result;
  } catch (error) {
    logger.timeEnd('CSS Bundle');
    throw new Error(`CSS bundling failed: ${error.message}`);
  }
}

// Find files recursively with extension filter
async function findFiles(dir, ext) {
  const files = [];

  async function scan(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scan(dir);
  return files;
}

// Optimized directory copying with change detection
async function copyDirOptimized(srcDir, dstDir, logger, cache = new Map()) {
  const label = `Copy ${path.relative(repoRoot, srcDir)}`;
  logger.time(label);

  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await ensureDir(dstDir);

    let copiedCount = 0;
    let skippedCount = 0;

    // Process entries in parallel with concurrency limit
    const concurrencyLimit = BUILD_CONFIG.maxConcurrency;
    for (let i = 0; i < entries.length; i += concurrencyLimit) {
      const batch = entries.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(async (entry) => {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);

        if (entry.isDirectory()) {
          const subCopied = await copyDirOptimized(srcPath, dstPath, logger, cache);
          copiedCount += subCopied.copied;
          skippedCount += subCopied.skipped;
        } else if (entry.isFile()) {
          const srcHash = await getFileHash(srcPath);
          const cacheKey = dstPath;

          if (cache.get(cacheKey) === srcHash) {
            skippedCount++;
            return;
          }

          await fs.copyFile(srcPath, dstPath);
          cache.set(cacheKey, srcHash);
          copiedCount++;
        }
      }));
    }

    logger.log(`Copied ${copiedCount} files, skipped ${skippedCount} unchanged files`);
    logger.timeEnd(label);
    return { copied: copiedCount, skipped: skippedCount };
  } catch (error) {
    logger.timeEnd(label);
    if (error.code === 'ENOENT') {
      logger.log(`Source directory ${srcDir} does not exist, skipping copy`, 'warn');
      return { copied: 0, skipped: 0 };
    } else {
      throw new Error(`Failed to copy directory from ${srcDir} to ${dstDir}: ${error.message}`);
    }
  }
}

function rewriteHtmlReferences(html, { cssHref, jsSrc }) {
  let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, `<link rel="stylesheet" href="${cssHref}">`);
  out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, `<script type="module" src="${jsSrc}"></script>`);
  return out;
}

// Load SVG assets for inlining
async function loadSvgAssets(svgDir, svgFiles, logger) {
  logger.time('Load SVG Assets');

  const svgAssets = {};

  await Promise.all(svgFiles.map(async (fname) => {
    const fpath = path.join(svgDir, fname);
    try {
      svgAssets[fname.replace('.svg', '')] = await fs.readFile(fpath, 'utf8');
      logger.log(`Loaded SVG asset: ${fname}`);
    } catch (error) {
      logger.log(`SVG asset missing: ${fpath}`, 'warn');
      svgAssets[fname.replace('.svg', '')] = '';
    }
  }));

  logger.timeEnd('Load SVG Assets');
  return svgAssets;
}

export async function build({ outDir = BUILD_CONFIG.defaultOutDir, incremental = false } = {}) {
  const logger = new BuildLogger('BUILD');
  logger.log(`Starting build to ${path.relative(repoRoot, outDir)}`);

  const cache = incremental ? new Map() : undefined;

  try {
    logger.time('Clean output directory');
    if (!incremental) {
      await rimraf(outDir);
    }
    await ensureDir(outDir);
    logger.timeEnd('Clean output directory');

    logger.log(`Build configuration: sourcemap=${BUILD_CONFIG.sourcemap}, minify=${BUILD_CONFIG.minify}, incremental=${incremental}`);

    // TypeScript/JavaScript bundle
    logger.time('TypeScript/JavaScript bundle');
    const result = await esbuild({
      entryPoints: {
        bundled: path.join(BUILD_CONFIG.srcDir, 'main.ts'),
        simWorker: path.join(BUILD_CONFIG.srcDir, 'simWorker.ts'),
      },
      outdir: outDir,
      bundle: true,
      format: BUILD_CONFIG.format,
      platform: BUILD_CONFIG.platform,
      target: BUILD_CONFIG.target,
      sourcemap: BUILD_CONFIG.sourcemap,
      sourcesContent: BUILD_CONFIG.sourcesContent,
      minify: BUILD_CONFIG.minify,
      splitting: false,
      logLevel: 'silent',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      },
    });
    logger.timeEnd('TypeScript/JavaScript bundle');

    // Create .ts alias for bundled.js
    try {
      const bundledJsPath = path.join(outDir, 'bundled.js');
      const asTsPath = path.join(outDir, 'bundled.ts');
      const jsContent = await fs.readFile(bundledJsPath, 'utf8');
      await fs.writeFile(asTsPath, jsContent, 'utf8');
      logger.log('Created bundled.ts alias');
    } catch (e) {
      logger.log(`Could not emit bundled.ts: ${e.message}`, 'warn');
    }

    // Log bundle sizes
    const mainJsSize = await getFileSize(path.join(outDir, 'bundled.js'));
    const workerJsSize = await getFileSize(path.join(outDir, 'simWorker.js'));
    logger.log(`JavaScript bundles: main=${formatBytes(mainJsSize)}, worker=${formatBytes(workerJsSize)}`);

    // CSS bundle
    const cssOut = path.join(outDir, 'bundled.css');
    await buildCssBundle({
      stylesDir: BUILD_CONFIG.stylesDir,
      outFile: cssOut,
      sourcemap: BUILD_CONFIG.sourcemap,
      sourcesContent: BUILD_CONFIG.sourcesContent,
      logger
    });

    // Asset copying
    logger.time('Asset copying');
    const copyResults = await Promise.all([
      copyDirOptimized(BUILD_CONFIG.assetsDir, path.join(outDir, 'assets'), logger, cache),
      // Preserve source-relative path so runtime can use './src/config/assets/svg/*.svg'
      copyDirOptimized(BUILD_CONFIG.svgConfigDir, path.join(outDir, 'src', 'config', 'assets', 'svg'), logger, cache),
      copyDirOptimized(BUILD_CONFIG.publicDir, outDir, logger, cache),
    ]);
    logger.timeEnd('Asset copying');

    // Generate HTML
    const uiHtmlPath = path.join(BUILD_CONFIG.srcDir, 'ui.html');
    const uiHtml = (await readIfExists(uiHtmlPath)) || '<!doctype html><html><head></head><body></body></html>';
    const htmlOut = rewriteHtmlReferences(uiHtml, {
      cssHref: './bundled.css',
      jsSrc: './bundled.js'
    });
    const namedHtmlOut = path.join(outDir, 'spaceautobattler.html');
    await fs.writeFile(namedHtmlOut, htmlOut, 'utf8');

    const htmlSize = await getFileSize(namedHtmlOut);
    logger.log(`HTML output: ${formatBytes(htmlSize)}`);

    const summary = logger.summary();

    return {
      outDir,
      files: {
        html: namedHtmlOut,
        js: path.join(outDir, 'bundled.js'),
        ts: path.join(outDir, 'bundled.ts'),
        worker: path.join(outDir, 'simWorker.js'),
        css: cssOut,
      },
      metafile: result?.metafile,
      summary,
      cache,
    };
  } catch (error) {
    logger.log(`Build failed: ${error.message}`, 'error');
    throw error;
  }
}

// Execute when run directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : BUILD_CONFIG.defaultOutDir;
  const incremental = process.argv.includes('--incremental') || process.argv.includes('-i');

  build({ outDir, incremental })
    .then((result) => {
      console.log(`✓ Build successful: ${result.outDir}`);
      console.log(`  HTML: ${path.relative(repoRoot, result.files.html)}`);
      console.log(`  JS:   ${path.relative(repoRoot, result.files.js)}`);
      console.log(`  TS:   ${path.relative(repoRoot, result.files.ts)}`);
      console.log(`  CSS:  ${path.relative(repoRoot, result.files.css)}`);
      console.log(`  Worker: ${path.relative(repoRoot, result.files.worker)}`);
    })
    .catch((error) => {
      console.error('✗ Build failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}
