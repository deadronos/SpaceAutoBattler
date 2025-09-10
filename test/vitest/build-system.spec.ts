import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// Test configuration
const TEST_CONFIG = {
  repoRoot: path.resolve(__dirname, '../..'),
  distDir: path.join(path.resolve(__dirname, '../..'), 'dist'),
  buildTimeout: 90000, // 90 seconds
};

describe('Build System Tests', () => {
  beforeAll(async () => {
    // If a recent build exists, keep it; otherwise build once for the suite.
    let recentBuild = false;
    try {
      const entries = await fs.readdir(TEST_CONFIG.distDir, { withFileTypes: true });
      const names = entries.map((e) => e.name);
      if (names.includes('spaceautobattler.html')) {
        let newest = 0;
        for (const e of entries) {
          try {
            const st = await fs.stat(path.join(TEST_CONFIG.distDir, e.name));
            newest = Math.max(newest, st.mtimeMs, st.ctimeMs);
          } catch {}
        }
        if (Date.now() - newest < 2 * 60 * 1000) recentBuild = true;
      }
    } catch {}

    if (!recentBuild) {
      try {
        await fs.rm(TEST_CONFIG.distDir, { recursive: true, force: true });
      } catch {}
      try {
        // Run build with piped stdio so worker threads don't inherit parent's stdio
        // which can cause failures in some CI/worker environments. Capture output
        // and rethrow with details on failure for easier debugging.
        const out = execSync('npm run build', {
          cwd: TEST_CONFIG.repoRoot,
          timeout: TEST_CONFIG.buildTimeout,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        // eslint-disable-next-line no-console
        console.debug && console.debug('build output:', out);
      } catch (err: any) {
        // If the build fails, include captured stdout/stderr when available
        const messageParts: string[] = [];
        if (err.stdout) messageParts.push('stdout:\n' + String(err.stdout));
        if (err.stderr) messageParts.push('stderr:\n' + String(err.stderr));
        messageParts.push('error:' + (err && err.message ? err.message : String(err)));
        throw new Error(messageParts.join('\n---\n'));
      }
      const start = Date.now();
      while (Date.now() - start < 3000) {
        try {
          const entries = await fs.readdir(TEST_CONFIG.distDir);
          const hasJs = entries.some((f) => f.endsWith('.js'));
          const hasHtml = entries.includes('spaceautobattler.html');
          const hasStyles = entries.includes('styles');
          if (hasJs && hasHtml && hasStyles) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }, TEST_CONFIG.buildTimeout + 20000);

  // Note: Keep dist/ after tests for inspection; no cleanup

  describe('npm run build', () => {
    it(
      'should produce expected output files',
      async () => {
        // Verify output directory exists
        const distExists = await fs
          .stat(TEST_CONFIG.distDir)
          .then(() => true)
          .catch(() => false);
        expect(distExists).toBe(true);

        // Be permissive about filenames: ensure at least one JS and one CSS file exist in dist,
        // and that the main HTML file is present. Search recursively to handle styles/ subdir.
        async function findFiles(dir: string, ext: string): Promise<string[]> {
          const out: string[] = [];
          const items = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[]);
          for (const it of items) {
            const p = path.join(dir, it.name);
            if (it.isDirectory()) {
              const nested = await findFiles(p, ext);
              out.push(...nested);
            } else if (it.isFile() && it.name.endsWith(ext)) {
              out.push(p);
            }
          }
          return out;
        }

        const jsFiles = await findFiles(TEST_CONFIG.distDir, '.js');
        const cssFiles = await findFiles(TEST_CONFIG.distDir, '.css');
        const htmlExists = await fs
          .stat(path.join(TEST_CONFIG.distDir, 'spaceautobattler.html'))
          .then(() => true)
          .catch(() => false);

        expect(jsFiles.length, 'Expected at least one .js file in dist').toBeGreaterThan(0);
        expect(cssFiles.length, 'Expected at least one .css file in dist').toBeGreaterThan(0);
        expect(htmlExists, 'Expected spaceautobattler.html to exist in dist').toBe(true);

        // Verify files have non-trivial content (jsFiles/cssFiles are absolute paths)
        for (const f of [...jsFiles.slice(0, 3), ...cssFiles.slice(0, 2)]) {
          const stats = await fs.stat(f);
          expect(stats.size).toBeGreaterThan(0);
        }
      },
      { timeout: TEST_CONFIG.buildTimeout + 10000 },
    );

    it('should produce valid JavaScript bundles', async () => {
      // Find representative JS files to validate
      const entries = await fs.readdir(TEST_CONFIG.distDir).catch(() => [] as string[]);
      const jsFiles = entries.filter((f) => f.endsWith('.js'));
      if (jsFiles.length === 0) {
        throw new Error('No JavaScript files found in dist to validate');
      }

      // Pick the largest JS file as representative
      let largestFile = jsFiles[0];
      let largestSize = (await fs.stat(path.join(TEST_CONFIG.distDir, largestFile))).size;
      for (const f of jsFiles.slice(1)) {
        const s = (await fs.stat(path.join(TEST_CONFIG.distDir, f))).size;
        if (s > largestSize) {
          largestFile = f;
          largestSize = s;
        }
      }

      expect(largestSize).toBeGreaterThan(1000); // At least 1KB
      const largestContent = await fs.readFile(path.join(TEST_CONFIG.distDir, largestFile), 'utf8');

      // Check for common JS/module markers and Three.js reference
      expect(largestContent).toMatch(/import|export/);
      expect(largestContent).toMatch(/THREE|three/);
    });

    it('should produce valid CSS bundle', async () => {
      // Recursively search for a CSS file under dist
      async function findCss(dir: string): Promise<string | null> {
        const items = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[]);
        for (const it of items) {
          const p = path.join(dir, it.name);
          if (it.isDirectory()) {
            const found = await findCss(p);
            if (found) return found;
          } else if (it.isFile() && it.name.endsWith('.css')) return p;
        }
        return null;
      }
      const cssPath = await findCss(TEST_CONFIG.distDir);
      if (!cssPath) throw new Error('No CSS files found in dist to validate');
      const cssStats = await fs.stat(cssPath);
      expect(cssStats.size).toBeGreaterThan(100); // At least 100 bytes
      const cssContent = await fs.readFile(cssPath, 'utf8');
      // Check for CSS patterns
      expect(cssContent).toMatch(/\{[^}]*\}/);
      expect(cssContent).toMatch(/[.#][a-zA-Z][\w-]*\s*\{/);
    });

    it('should produce valid HTML file', async () => {
      const htmlPath = path.join(TEST_CONFIG.distDir, 'spaceautobattler.html');
      const htmlStats = await fs.stat(htmlPath);
      expect(htmlStats.size).toBeGreaterThan(100); // At least 100 bytes
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      // Basic HTML structure
      expect(htmlContent).toMatch(/<!DOCTYPE html>/i);
      expect(htmlContent).toMatch(/<html[^>]*>/i);
      expect(htmlContent).toMatch(/<head[^>]*>/i);
      expect(htmlContent).toMatch(/<body[^>]*>/i);
      // Check for any CSS/JS asset references in the HTML (be permissive on filenames)
      expect(htmlContent).toMatch(/<link[^>]+href=["'][^"']+\.css["']/);
      expect(htmlContent).toMatch(/<script[^>]+src=["'][^"']+\.js["']/);
    });

    it('should copy assets correctly', async () => {
      // Check if assets directory exists
      const assetsDir = path.join(TEST_CONFIG.distDir, 'assets');
      const assetsExists = await fs
        .stat(assetsDir)
        .then(() => true)
        .catch(() => false);

      if (assetsExists) {
        // If assets exist, verify they have content
        const assetsContent = await fs.readdir(assetsDir);
        expect(assetsContent.length).toBeGreaterThan(0);
      }

      // Check SVG assets are preserved under src/config/assets/svg
      const srcSvgDir = path.join(TEST_CONFIG.repoRoot, 'src', 'config', 'assets', 'svg');
      const distSvgDir = path.join(TEST_CONFIG.distDir, 'src', 'config', 'assets', 'svg');
      const srcExists = await fs
        .stat(srcSvgDir)
        .then(() => true)
        .catch(() => false);
      const distExists = await fs
        .stat(distSvgDir)
        .then(() => true)
        .catch(() => false);
      expect(srcExists).toBe(true);
      expect(distExists).toBe(true);

      const srcFiles = (await fs.readdir(srcSvgDir)).filter((f) => f.endsWith('.svg')).sort();
      const distFiles = (await fs.readdir(distSvgDir)).filter((f) => f.endsWith('.svg')).sort();
      expect(distFiles).toEqual(srcFiles);

      // Verify file contents are identical
      for (const f of srcFiles) {
        const [srcContent, distContent] = await Promise.all([
          fs.readFile(path.join(srcSvgDir, f), 'utf8'),
          fs.readFile(path.join(distSvgDir, f), 'utf8'),
        ]);
        expect(distContent).toBe(srcContent);
        expect(distContent).toMatch(/<svg[^>]*>/);
      }
    });
  });
});
