import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

// Read the test page template and module so we can inline them for robust testing when the external server
// does not serve /test/ paths. In CI we prefer tests to be self-contained and only rely on the server for
// static model assets (e.g., /dist/models/*.glb).
const htmlTemplatePath = path.join(
  process.cwd(),
  'test',
  'playwright',
  'pages',
  'ship-renderer.html',
);
const jsModulePath = path.join(process.cwd(), 'test', 'playwright', 'pages', 'ship-renderer.js');
let inlinedHtml = null;
try {
  const htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');
  let jsModule = fs.readFileSync(jsModulePath, 'utf8');
  // Replace Node-style or bundler 'three' bare imports with CDN ESM imports so inline module executes in browser.
  jsModule = jsModule.replace(
    /from\s+['"]three['"];?/g,
    "from 'https://unpkg.com/three@0.150.1/build/three.module.js';",
  );
  jsModule = jsModule.replace(/from\s+['"]three\/examples\/jsm\/loaders\/(.+?)['"];?/g, (m, p1) => {
    return `from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/${p1}';`;
  });
  inlinedHtml = htmlTemplate.replace(
    '<script type="module" src="./ship-renderer.js"></script>',
    `<script type="module">${jsModule}</script>`,
  );
} catch {
  // If reading fails, we'll fall back to navigating to the hosted page; tests will still try both ways.
  inlinedHtml = null;
}

// Baseline and debug directories
const baselineDir = path.join(process.cwd(), 'test', 'playwright', 'baselines');
const debugDir = path.join(process.cwd(), 'test', 'playwright', 'debug');
if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });
if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

// Hulls to validate
const HULLS_TO_TEST = ['fighter', 'frigate', 'carrier'];

// Helper to build test page URL
function buildUrl(hull: string, pp: boolean, modelPath?: string) {
  const paramsObj: any = { hull, shield: 'true', postprocessing: String(pp) };
  if (modelPath) paramsObj.model = modelPath;
  const params = new URLSearchParams(paramsObj);
  return `/test/playwright/pages/ship-renderer.html?${params.toString()}`;
}

// Node-side helper: try to find a built model filename under known dist locations
function findModelFileOnHost(hull: string) {
  const candidateDirs = [
    path.join(process.cwd(), 'dist', 'models'),
    path.join(process.cwd(), 'assets', 'models'),
    path.join(process.cwd(), 'public', 'models'),
  ];
  const patterns = [new RegExp(`^${hull}.*\\.glb$`, 'i'), new RegExp(`.*${hull}.*\\.glb$`, 'i')];

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (patterns.some((p) => p.test(f))) {
          // Return a URL path relative to server root
          const rel = path
            .join('/', path.relative(process.cwd(), dir), f)
            .replace(/\\/g, '/')
            .replace(/\\\\/g, '/');
          // Ensure any single backslashes are normalized as well (Windows paths)
          const normalized = rel.replace(/\\/g, '/');
          return normalized;
        }
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}

// Utility: compute non-black pixel ratio and detect green 'Initializing...' text in top-left region
function analyzePngBuffer(buf: any) {
  const png = PNG.sync.read(buf as any);
  const { width, height, data } = png;
  let nonBlack = 0;
  let total = width * height;

  // Top-left region to inspect for 'Initializing...' green text
  const inspectW = Math.min(240, width);
  const inspectH = Math.min(64, height);
  let greenCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      // Non-black if any RGB channel above small threshold and alpha > 10
      if (a > 10 && (r > 8 || g > 8 || b > 8)) nonBlack++;
      if (x < inspectW && y < inspectH) {
        // Bright green-ish detection: G dominant and fairly bright
        if (g > 160 && g > r + 80 && g > b + 80) greenCount++;
      }
    }
  }

  const nonBlackRatio = nonBlack / total;
  const greenRatio = greenCount / (inspectW * inspectH);
  return { width, height, nonBlackRatio, greenRatio };
}

const MIN_NON_BLACK_RATIO = 0.0001; // 0.01% non-black pixels required (ship can be small in frame)
const MAX_INIT_GREEN_RATIO = 0.01; // if >1% of top-left area is bright green, treat as 'Initializing...'

// Capture canvas with a few retries to mitigate transient black/initializing frames
async function captureCanvasWithRetries(
  page: any,
  canvasLocator: any,
  attempts = 8,
  delayMs = 500,
) {
  let lastBuf: Buffer | null = null;
  let lastAnalysis: any = null;
  for (let i = 0; i < attempts; i++) {
    const buf = await canvasLocator.screenshot({ type: 'png' });
    lastBuf = buf;
    lastAnalysis = analyzePngBuffer(buf);
    if (
      lastAnalysis.nonBlackRatio >= MIN_NON_BLACK_RATIO &&
      lastAnalysis.greenRatio <= MAX_INIT_GREEN_RATIO
    ) {
      return { buf, analysis: lastAnalysis };
    }
    // small pause before retrying
    await page.waitForTimeout(delayMs);
  }
  return { buf: lastBuf, analysis: lastAnalysis };
}

// Basic setup
test.describe('Shield visual baseline (postprocessing on/off)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Browser console error:', msg.text());
    });
  });

  for (const hull of HULLS_TO_TEST) {
    test(`captures shield screenshot for ${hull} (PP off)`, async ({ page }, testInfo) => {
      // Attempt to discover a built model and pass it explicitly to the test page.
      const modelPath = findModelFileOnHost(hull);
      const pp = false;
      const initParams = { hull, shield: true, postprocessing: pp, model: modelPath };

      if (inlinedHtml) {
        // Inject init params before the module runs, then set the page content with inline module.
        await page.addInitScript({
          content: `window.__TEST_INIT_PARAMS = ${JSON.stringify(initParams)};`,
        });
        await page.setContent(inlinedHtml, { waitUntil: 'load' });
      } else {
        await page.goto(buildUrl(hull, pp, modelPath ?? undefined));
      }
      await page.waitForSelector('#canvas');
      // Wait for test page to signal readiness
      const ready = await page.evaluate(async () => {
        if (
          (window as any).__TEST__ &&
          typeof (window as any).__TEST__.waitForReady === 'function'
        ) {
          return await (window as any).__TEST__.waitForReady();
        }
        return { frameRendered: 0 };
      });
      // Ensure the page initialized successfully before creating or comparing baselines.
      expect(ready).toBeTruthy();
      expect(ready.error).toBeUndefined();
      expect(ready.frameRendered).toBeGreaterThanOrEqual(0);
      const canvas = page.locator('#canvas');
      // If available, gather scene summary to decide if the page actually has model meshes present.
      const sceneSummary = await page.evaluate(async () => {
        if (
          (window as any).__TEST__ &&
          typeof (window as any).__TEST__.getSceneSummary === 'function'
        ) {
          return await (window as any).__TEST__.getSceneSummary();
        }
        return null;
      });
      const sceneMeshCount =
        sceneSummary && typeof sceneSummary.meshCount === 'number' ? sceneSummary.meshCount : 0;
      const { buf: imgBuffer, analysis } = await captureCanvasWithRetries(page, canvas);

      const projectName =
        testInfo.project && testInfo.project.name
          ? String(testInfo.project.name).replace(/\s+/g, '-')
          : 'unknown';
      const baselineName = `shield-${hull}-pp-off-${projectName}.png`;
      const baselinePath = path.join(baselineDir, baselineName);

      if (!fs.existsSync(baselinePath)) {
        // Only write a baseline when the page reported successful initialization.
        if (ready.error || (typeof ready.frameRendered === 'number' && ready.frameRendered < 0)) {
          throw new Error(
            `Page failed to initialize for ${hull} (PP off); refusing to write baseline. ${ready.error ? String(ready.error) : ''}`,
          );
        }
        // Additional safety: refuse to write mostly-empty images or images that show the green "Initializing..." text
        if (analysis.nonBlackRatio < MIN_NON_BLACK_RATIO && sceneMeshCount === 0) {
          const dbg = path.join(debugDir, `rejected-${baselineName}`);
          fs.writeFileSync(dbg, imgBuffer);
          throw new Error(
            `Refusing to write baseline for ${hull} (PP off): image is mostly black (nonBlackRatio=${analysis.nonBlackRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        if (analysis.greenRatio > MAX_INIT_GREEN_RATIO) {
          const dbg = path.join(debugDir, `rejected-initializing-${baselineName}`);
          fs.writeFileSync(dbg, imgBuffer);
          throw new Error(
            `Refusing to write baseline for ${hull} (PP off): detected initializing text (greenRatio=${analysis.greenRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        fs.writeFileSync(baselinePath, imgBuffer);
        console.log(`Generated baseline: ${baselinePath}`);
      } else {
        const baselineBuffer = fs.readFileSync(baselinePath);
        const baselinePng = PNG.sync.read(baselineBuffer);
        const actualPng = PNG.sync.read(imgBuffer);
        // Reject comparisons if actual image looks like 'Initializing...'
        const actualAnalysis = analyzePngBuffer(imgBuffer);
        if (actualAnalysis.nonBlackRatio < MIN_NON_BLACK_RATIO && sceneMeshCount === 0) {
          const dbg = path.join(debugDir, `rejected-compare-${baselineName}`);
          fs.writeFileSync(dbg, imgBuffer);
          throw new Error(
            `Captured image for ${hull} (PP off) is mostly black (nonBlackRatio=${actualAnalysis.nonBlackRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        if (actualAnalysis.greenRatio > MAX_INIT_GREEN_RATIO) {
          const dbg = path.join(debugDir, `rejected-initializing-compare-${baselineName}`);
          fs.writeFileSync(dbg, imgBuffer);
          throw new Error(
            `Captured image for ${hull} (PP off) appears to show 'Initializing...' (greenRatio=${actualAnalysis.greenRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        const { width, height } = baselinePng;
        const diff = new PNG({ width, height });
        const diffPixels = pixelmatch(baselinePng.data, actualPng.data, diff.data, width, height, {
          threshold: 0.1,
        });
        const diffRatio = diffPixels / (width * height);
        expect(diffRatio).toBeLessThanOrEqual(0.06);
      }
    });

    test(`captures shield screenshot for ${hull} (PP on)`, async ({ page }, testInfo) => {
      // Attempt to discover a built model and pass it explicitly to the test page.
      const modelPathOn = findModelFileOnHost(hull);
      const ppOn = true;
      const initParamsOn = { hull, shield: true, postprocessing: ppOn, model: modelPathOn };
      if (inlinedHtml) {
        await page.addInitScript({
          content: `window.__TEST_INIT_PARAMS = ${JSON.stringify(initParamsOn)};`,
        });
        await page.setContent(inlinedHtml, { waitUntil: 'load' });
      } else {
        await page.goto(buildUrl(hull, true, modelPathOn ?? undefined));
      }
      await page.waitForSelector('#canvas');
      // Wait for test page to signal readiness
      const readyOn = await page.evaluate(async () => {
        if (
          (window as any).__TEST__ &&
          typeof (window as any).__TEST__.waitForReady === 'function'
        ) {
          return await (window as any).__TEST__.waitForReady();
        }
        return { frameRendered: 0 };
      });
      // Ensure the page initialized successfully before creating or comparing baselines.
      expect(readyOn).toBeTruthy();
      expect(readyOn.error).toBeUndefined();
      expect(readyOn.frameRendered).toBeGreaterThanOrEqual(0);
      const canvasOn = page.locator('#canvas');
      const sceneSummaryOn = await page.evaluate(async () => {
        if (
          (window as any).__TEST__ &&
          typeof (window as any).__TEST__.getSceneSummary === 'function'
        ) {
          return await (window as any).__TEST__.getSceneSummary();
        }
        return null;
      });
      const sceneMeshCountOn =
        sceneSummaryOn && typeof sceneSummaryOn.meshCount === 'number'
          ? sceneSummaryOn.meshCount
          : 0;
      const { buf: imgBufferOn, analysis: analysisOn } = await captureCanvasWithRetries(
        page,
        canvasOn,
      );
      const projectNameOn =
        testInfo.project && testInfo.project.name
          ? String(testInfo.project.name).replace(/\s+/g, '-')
          : 'unknown';
      const baselineNameOn = `shield-${hull}-pp-on-${projectNameOn}.png`;
      const baselinePathOn = path.join(baselineDir, baselineNameOn);

      if (!fs.existsSync(baselinePathOn)) {
        // Only write a baseline when the page reported successful initialization.
        if (
          readyOn.error ||
          (typeof readyOn.frameRendered === 'number' && readyOn.frameRendered < 0)
        ) {
          throw new Error(
            `Page failed to initialize for ${hull} (PP on); refusing to write baseline. ${readyOn.error ? String(readyOn.error) : ''}`,
          );
        }
        // Additional safety: refuse to write mostly-empty images or images that show the green "Initializing..." text
        if (analysisOn.nonBlackRatio < MIN_NON_BLACK_RATIO && sceneMeshCountOn === 0) {
          const dbg = path.join(debugDir, `rejected-${baselineNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Refusing to write baseline for ${hull} (PP on): image is mostly black (nonBlackRatio=${analysisOn.nonBlackRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        if (analysisOn.greenRatio > MAX_INIT_GREEN_RATIO) {
          const dbg = path.join(debugDir, `rejected-initializing-${baselineNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Refusing to write baseline for ${hull} (PP on): detected initializing text (greenRatio=${analysisOn.greenRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        fs.writeFileSync(baselinePathOn, imgBufferOn);
        console.log(`Generated baseline: ${baselinePathOn}`);
      } else {
        const baselineBufferOn = fs.readFileSync(baselinePathOn);
        const baselinePng = PNG.sync.read(baselineBufferOn);
        const actualPng = PNG.sync.read(imgBufferOn);
        const actualAnalysisOn = analyzePngBuffer(imgBufferOn);
        if (actualAnalysisOn.nonBlackRatio < MIN_NON_BLACK_RATIO && sceneMeshCountOn === 0) {
          const dbg = path.join(debugDir, `rejected-compare-${baselineNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Captured image for ${hull} (PP on) is mostly black (nonBlackRatio=${actualAnalysisOn.nonBlackRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        if (actualAnalysisOn.greenRatio > MAX_INIT_GREEN_RATIO) {
          const dbg = path.join(debugDir, `rejected-initializing-compare-${baselineNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Captured image for ${hull} (PP on) appears to show 'Initializing...' (greenRatio=${actualAnalysisOn.greenRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        const { width, height } = baselinePng;
        const diff = new PNG({ width, height });
        const diffPixels = pixelmatch(baselinePng.data, actualPng.data, diff.data, width, height, {
          threshold: 0.1,
        });
        const diffRatio = diffPixels / (width * height);
        expect(diffRatio).toBeLessThanOrEqual(0.06);
      }
    });

    test(`verifies shield scene summary for ${hull} (PP on)`, async ({ page }, testInfo) => {
      // Attempt to discover a built model and pass it explicitly to the test page.
      const modelPathOn = findModelFileOnHost(hull);
      const ppOn = true;
      const initParamsOn = { hull, shield: true, postprocessing: ppOn, model: modelPathOn };
      if (inlinedHtml) {
        await page.addInitScript({
          content: `window.__TEST_INIT_PARAMS = ${JSON.stringify(initParamsOn)};`,
        });
        await page.setContent(inlinedHtml, { waitUntil: 'load' });
      } else {
        await page.goto(buildUrl(hull, true, modelPathOn ?? undefined));
      }
      await page.waitForSelector('#canvas');
      // Wait for test page to signal readiness
      const readyOn = await page.evaluate(async () => {
        if (
          (window as any).__TEST__ &&
          typeof (window as any).__TEST__.waitForReady === 'function'
        ) {
          return await (window as any).__TEST__.waitForReady();
        }
        return { frameRendered: 0 };
      });
      // Ensure the page initialized successfully before creating or comparing baselines.
      expect(readyOn).toBeTruthy();
      expect(readyOn.error).toBeUndefined();
      expect(readyOn.frameRendered).toBeGreaterThanOrEqual(0);
      const canvasOn = page.locator('#canvas');
      const { buf: imgBufferOn, analysis: actualAnalysisOn } = await captureCanvasWithRetries(
        page,
        canvasOn,
      );
      const projectNameOn =
        testInfo.project && testInfo.project.name
          ? String(testInfo.project.name).replace(/\s+/g, '-')
          : 'unknown';
      const summaryNameOn = `shield-${hull}-summary-${projectNameOn}.png`;
      const summaryPathOn = path.join(baselineDir, summaryNameOn);

      if (!fs.existsSync(summaryPathOn)) {
        fs.writeFileSync(summaryPathOn, imgBufferOn);
        console.log(`Generated summary: ${summaryPathOn}`);
      } else {
        const summaryBufferOn = fs.readFileSync(summaryPathOn);
        const baselinePng = PNG.sync.read(summaryBufferOn);
        const actualPng = PNG.sync.read(imgBufferOn);
        const actualAnalysisOn = analyzePngBuffer(imgBufferOn);
        if (actualAnalysisOn.nonBlackRatio < MIN_NON_BLACK_RATIO) {
          const dbg = path.join(debugDir, `rejected-summary-compare-${summaryNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Captured summary image for ${hull} (PP on) is mostly black (nonBlackRatio=${actualAnalysisOn.nonBlackRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        if (actualAnalysisOn.greenRatio > MAX_INIT_GREEN_RATIO) {
          const dbg = path.join(debugDir, `rejected-initializing-summary-compare-${summaryNameOn}`);
          fs.writeFileSync(dbg, imgBufferOn);
          throw new Error(
            `Captured summary image for ${hull} (PP on) appears to show 'Initializing...' (greenRatio=${actualAnalysisOn.greenRatio.toFixed(4)}). Saved rejected image to ${dbg}`,
          );
        }
        const { width, height } = baselinePng;
        const diff = new PNG({ width, height });
        const diffPixels = pixelmatch(baselinePng.data, actualPng.data, diff.data, width, height, {
          threshold: 0.1,
        });
        const diffRatio = diffPixels / (width * height);
        expect(diffRatio).toBeLessThanOrEqual(0.06);
      }
    });
  }
});
