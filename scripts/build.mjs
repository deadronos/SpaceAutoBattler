import { build as esbuild } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Build configuration and utilities
class BuildLogger {
  constructor() {
    this.startTime = Date.now();
    this.steps = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
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
    this.log(`Build completed in ${totalTime}ms`);
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Build CSS via esbuild to produce a single bundled stylesheet with sourcemaps
async function buildCssBundle({ stylesDir, outFile, sourcemap = true, sourcesContent = true, logger }) {
  logger.time('CSS Bundle');

  try {
    // Create a virtual CSS entry that @imports all CSS files in a stable order
    const entries = await fs.readdir(stylesDir, { withFileTypes: true }).catch(() => []);
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.css')).map(e => e.name).sort();

    if (files.length === 0) {
      logger.log(`No CSS files found in ${stylesDir}, creating empty bundle`);
      // No CSS files; still emit an empty file and empty sourcemap for consistency
      await fs.writeFile(outFile, '', 'utf8');
      if (sourcemap) await fs.writeFile(outFile + '.map', JSON.stringify({ version: 3, sources: [], mappings: '' }), 'utf8');
      logger.timeEnd('CSS Bundle');
      return;
    }

    const imports = files.map(name => `@import "./${name}";`).join('\n');
    logger.log(`Bundling ${files.length} CSS files: ${files.join(', ')}`);

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

async function copyDir(srcDir, dstDir, logger) {
  logger.time(`Copy ${path.relative(repoRoot, srcDir)}`);

  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await ensureDir(dstDir);

    let fileCount = 0;
    for (const e of entries) {
      const s = path.join(srcDir, e.name);
      const d = path.join(dstDir, e.name);
      if (e.isDirectory()) {
        await copyDir(s, d, logger);
      } else if (e.isFile()) {
        await fs.copyFile(s, d);
        fileCount++;
      }
    }

    logger.log(`Copied ${fileCount} files to ${path.relative(repoRoot, dstDir)}`);
    logger.timeEnd(`Copy ${path.relative(repoRoot, srcDir)}`);
  } catch (error) {
    logger.timeEnd(`Copy ${path.relative(repoRoot, srcDir)}`);
    if (error.code === 'ENOENT') {
      logger.log(`Source directory ${srcDir} does not exist, skipping copy`, 'warn');
    } else {
      throw new Error(`Failed to copy directory from ${srcDir} to ${dstDir}: ${error.message}`);
    }
  }
}

function rewriteHtmlReferences(html, { cssHref, jsSrc }) {
  let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/i, `<link rel="stylesheet" href="${cssHref}">`);
  out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i, `<script type="module" src="${jsSrc}"><\/script>`);
  return out;
}

export async function build({ outDir = path.join(repoRoot, 'dist') } = {}) {
  const logger = new BuildLogger();
  logger.log(`Starting build to ${path.relative(repoRoot, outDir)}`);

  try {
    const srcDir = path.join(repoRoot, 'src');

    // Pure TypeScript build: all runtime logic is sourced from /src/*.ts files.
    // No JS shims or transpilation steps are required.
    const uiHtmlPath = path.join(srcDir, 'ui.html');
    const stylesDir = path.join(srcDir, 'styles');
    const assetsDir = path.join(srcDir, 'assets');
    // Additional config-time SVG assets used by renderers (ship hulls)
    const svgConfigDir = path.join(srcDir, 'config', 'assets', 'svg');
    const publicDir = path.join(repoRoot, 'public');

    logger.time('Clean output directory');
    await rimraf(outDir);
    await ensureDir(outDir);
    logger.timeEnd('Clean output directory');

    // Allow environment overrides for sourcemap mode and sourcesContent embedding
    const smEnv = process.env.SOURCEMAP;
    const sourcemapOpt = (smEnv === 'inline' || smEnv === 'external' || smEnv === 'linked') ? smEnv : (smEnv === 'false' ? false : true);
    const scEnv = process.env.SOURCES_CONTENT;
    const sourcesContentOpt = scEnv === 'false' ? false : true;

    logger.log(`Build configuration: sourcemap=${sourcemapOpt}, sourcesContent=${sourcesContentOpt}`);

    logger.time('TypeScript/JavaScript bundle');
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
      sourcemap: sourcemapOpt,
      sourcesContent: sourcesContentOpt,
      splitting: false,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    logger.timeEnd('TypeScript/JavaScript bundle');

    // Log bundle sizes
    const mainJsSize = await getFileSize(path.join(outDir, 'bundled.js'));
    const workerJsSize = await getFileSize(path.join(outDir, 'simWorker.js'));
    logger.log(`JavaScript bundles: main=${formatBytes(mainJsSize)}, worker=${formatBytes(workerJsSize)}`);

    logger.time('CSS bundle');
    const cssOut = path.join(outDir, 'bundled.css');
    await buildCssBundle({ stylesDir, outFile: cssOut, sourcemap: sourcemapOpt, sourcesContent: sourcesContentOpt, logger });
    logger.timeEnd('CSS bundle');

    const cssSize = await getFileSize(cssOut);
    logger.log(`CSS bundle: ${formatBytes(cssSize)}`);

    logger.time('Asset copying');
    await copyDir(assetsDir, path.join(outDir, 'assets'), logger);
    // Expose SVGs at ./svg/ so AssetsConfig.svgAssets relative paths work in browser builds
    await copyDir(svgConfigDir, path.join(outDir, 'svg'), logger);
    await copyDir(publicDir, outDir, logger);
    logger.timeEnd('Asset copying');

    // Output main JS bundle only (no .ts copy needed for runtime)
    const mainJsPath = path.join(outDir, 'bundled.js');

    const uiHtml = (await readIfExists(uiHtmlPath)) || '<!doctype html><html><head></head><body></body></html>';

    // Load the JS bundle with a .js extension for correct MIME type.
    // All logic is bundled from TypeScript sources.
    const htmlOut = rewriteHtmlReferences(uiHtml, { cssHref: './bundled.css', jsSrc: './bundled.js' });
    const namedHtmlOut = path.join(outDir, 'spaceautobattler.html');
    await fs.writeFile(namedHtmlOut, htmlOut, 'utf8');

    const htmlSize = await getFileSize(namedHtmlOut);
    logger.log(`HTML output: ${formatBytes(htmlSize)}`);

    logger.summary();

    return {
      outDir,
      files: {
        html: namedHtmlOut,
        js: mainJsPath,
        worker: path.join(outDir, 'simWorker.js'),
        css: cssOut,
      },
      metafile: result?.metafile,
    };
  } catch (error) {
    logger.log(`Build failed: ${error.message}`, 'error');
    throw error;
  }
}


// When executed directly via `node scripts/build.mjs`, run the build.
// This script now builds exclusively from TypeScript sources in /src.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(repoRoot, 'dist');

  build({ outDir })
    .then((result) => {
      console.log(`✓ Build successful: ${result.outDir}`);
      console.log(`  HTML: ${path.relative(repoRoot, result.files.html)}`);
      console.log(`  JS:   ${path.relative(repoRoot, result.files.js)}`);
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
