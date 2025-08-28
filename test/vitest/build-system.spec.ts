import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// Test configuration
const TEST_CONFIG = {
  repoRoot: path.resolve(__dirname, '../..'),
  distDir: path.join(path.resolve(__dirname, '../..'), 'dist'),
  buildTimeout: 30000, // 30 seconds
};

describe('Build System Tests', () => {
  beforeAll(async () => {
    // Clean any existing dist directory
    try {
      await fs.rm(TEST_CONFIG.distDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, which is fine
    }
  });

  afterAll(async () => {
    // Clean up test artifacts
    try {
      await fs.rm(TEST_CONFIG.distDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('npm run build', () => {
    it('should produce expected output files', async () => {
      // Execute build command
      execSync('npm run build', {
        cwd: TEST_CONFIG.repoRoot,
        timeout: TEST_CONFIG.buildTimeout,
        stdio: 'inherit'
      });

      // Verify output directory exists
      const distExists = await fs.stat(TEST_CONFIG.distDir).then(() => true).catch(() => false);
      expect(distExists).toBe(true);

      // Check for expected files
      const expectedFiles = [
        'bundled.js',
        'bundled.ts',
        'simWorker.js',
        'bundled.css',
        'spaceautobattler.html'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(TEST_CONFIG.distDir, file);
        const exists = await fs.stat(filePath).then(() => true).catch(() => false);
        expect(exists, `Expected file ${file} should exist`).toBe(true);

        // Verify files have content
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    it('should produce valid JavaScript bundles', async () => {
      const bundledJsPath = path.join(TEST_CONFIG.distDir, 'bundled.js');
      const simWorkerJsPath = path.join(TEST_CONFIG.distDir, 'simWorker.js');

      // Check file sizes are reasonable (not empty, not too small)
      const bundledStats = await fs.stat(bundledJsPath);
      const workerStats = await fs.stat(simWorkerJsPath);

      expect(bundledStats.size).toBeGreaterThan(1000); // At least 1KB
      expect(workerStats.size).toBeGreaterThan(1000); // At least 1KB

      // Verify files contain expected content patterns
      const bundledContent = await fs.readFile(bundledJsPath, 'utf8');
      const workerContent = await fs.readFile(simWorkerJsPath, 'utf8');

      // Check for ES module patterns
      expect(bundledContent).toMatch(/import|export/);
      expect(workerContent).toMatch(/import|export/);

      // Check for Three.js usage (common dependency)
      expect(bundledContent).toMatch(/THREE|three/);
    });

    it('should produce valid CSS bundle', async () => {
      const cssPath = path.join(TEST_CONFIG.distDir, 'bundled.css');

      const cssStats = await fs.stat(cssPath);
      expect(cssStats.size).toBeGreaterThan(100); // At least 100 bytes

      const cssContent = await fs.readFile(cssPath, 'utf8');

      // Check for CSS patterns
      expect(cssContent).toMatch(/\{[^}]*\}/); // CSS rules
      expect(cssContent).toMatch(/[.#][a-zA-Z][\w-]*\s*\{/); // CSS selectors
    });

    it('should produce valid HTML file', async () => {
      const htmlPath = path.join(TEST_CONFIG.distDir, 'spaceautobattler.html');

      const htmlStats = await fs.stat(htmlPath);
      expect(htmlStats.size).toBeGreaterThan(100); // At least 100 bytes

      const htmlContent = await fs.readFile(htmlPath, 'utf8');

      // Check for HTML structure
      expect(htmlContent).toMatch(/<!DOCTYPE html>/i);
      expect(htmlContent).toMatch(/<html[^>]*>/i);
      expect(htmlContent).toMatch(/<head[^>]*>/i);
      expect(htmlContent).toMatch(/<body[^>]*>/i);

      // Check for asset references
      expect(htmlContent).toMatch(/bundled\.css/);
      expect(htmlContent).toMatch(/bundled\.js/);
    });

    it('should copy assets correctly', async () => {
      // Check if assets directory exists
      const assetsDir = path.join(TEST_CONFIG.distDir, 'assets');
      const assetsExists = await fs.stat(assetsDir).then(() => true).catch(() => false);

      if (assetsExists) {
        // If assets exist, verify they have content
        const assetsContent = await fs.readdir(assetsDir);
        expect(assetsContent.length).toBeGreaterThan(0);
      }

      // Check SVG assets
      const svgDir = path.join(TEST_CONFIG.distDir, 'svg');
      const svgExists = await fs.stat(svgDir).then(() => true).catch(() => false);

      if (svgExists) {
        const svgFiles = await fs.readdir(svgDir);
        expect(svgFiles.length).toBeGreaterThan(0);

        // Verify SVG files are valid
        for (const svgFile of svgFiles) {
          if (svgFile.endsWith('.svg')) {
            const svgPath = path.join(svgDir, svgFile);
            const svgContent = await fs.readFile(svgPath, 'utf8');
            expect(svgContent).toMatch(/<svg[^>]*>/);
          }
        }
      }
    });
  });

  describe('npm run build-standalone', () => {
    it('should produce standalone HTML file', async () => {
      // Execute standalone build command
      execSync('npm run build-standalone', {
        cwd: TEST_CONFIG.repoRoot,
        timeout: TEST_CONFIG.buildTimeout,
        stdio: 'inherit'
      });

      // Verify standalone file exists
      const standalonePath = path.join(TEST_CONFIG.distDir, 'spaceautobattler_standalone.html');
      const exists = await fs.stat(standalonePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify file has content
      const stats = await fs.stat(standalonePath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
    });

    it('should inline all assets correctly', async () => {
      const standalonePath = path.join(TEST_CONFIG.distDir, 'spaceautobattler_standalone.html');
      const content = await fs.readFile(standalonePath, 'utf8');

      // Check for inlined assets
      expect(content).toMatch(/<style>/); // Inlined CSS
      expect(content).toMatch(/<script[^>]*>/); // Inlined JavaScript
      expect(content).toMatch(/__INLINE_SVG_ASSETS/); // Inlined SVG assets
      expect(content).toMatch(/getWorkerScript/); // Inlined worker code function

      // Verify no external references remain
      expect(content).not.toMatch(/<link[^>]+href=["'][^"']+\.css["']/); // No external CSS links
      expect(content).not.toMatch(/<script[^>]+src=["'][^"']+\.js["']/); // No external JS scripts

      // Verify SVG assets are properly inlined
      expect(content).toMatch(/"fighter":/);
      expect(content).toMatch(/"corvette":/);
      expect(content).toMatch(/"frigate":/);
      expect(content).toMatch(/"destroyer":/);
      expect(content).toMatch(/"carrier":/);
    });

    it('should produce valid standalone HTML', async () => {
      const standalonePath = path.join(TEST_CONFIG.distDir, 'spaceautobattler_standalone.html');
      const content = await fs.readFile(standalonePath, 'utf8');

      // Check HTML structure
      expect(content).toMatch(/<!DOCTYPE html>/i);
      expect(content).toMatch(/<html[^>]*>/i);
      expect(content).toMatch(/<head[^>]*>/i);
      expect(content).toMatch(/<body[^>]*>/i);

      // Verify the file is self-contained (no external dependencies)
      const lines = content.split('\n');
      const hasExternalRefs = lines.some(line =>
        line.includes('http://') ||
        line.includes('https://') ||
        (line.includes('src=') && !line.includes('data:') && !line.includes('__worker') && !line.includes('getWorkerScript'))
      );
      expect(hasExternalRefs).toBe(false);
    });

    it('should have reasonable file size', async () => {
      const standalonePath = path.join(TEST_CONFIG.distDir, 'spaceautobattler_standalone.html');
      const stats = await fs.stat(standalonePath);

      // Standalone should be reasonably sized (not too small, not too large)
      expect(stats.size).toBeGreaterThan(50000); // At least 50KB (with inlined assets)
      expect(stats.size).toBeLessThan(10000000); // Less than 10MB (reasonable limit)
    });
  });

  describe.skip('Build comparison', () => {
    it('should show size differences between regular and standalone builds', async () => {
      // Get sizes from both builds
      const regularFiles = [
        path.join(TEST_CONFIG.distDir, 'bundled.js'),
        path.join(TEST_CONFIG.distDir, 'bundled.css'),
        path.join(TEST_CONFIG.distDir, 'spaceautobattler.html')
      ];

      const standaloneFile = path.join(TEST_CONFIG.distDir, 'spaceautobattler_standalone.html');

      let regularTotal = 0;
      for (const file of regularFiles) {
        try {
          const stats = await fs.stat(file);
          regularTotal += stats.size;
        } catch (error) {
          // File might not exist, skip
        }
      }

      const standaloneStats = await fs.stat(standaloneFile);
      const standaloneSize = standaloneStats.size;

      // Standalone should be larger than individual files due to inlining
      // but potentially smaller than sum due to minification
      expect(standaloneSize).toBeGreaterThan(0);
      expect(regularTotal).toBeGreaterThan(0);

      console.log(`Regular build total: ${regularTotal} bytes`);
      console.log(`Standalone build: ${standaloneSize} bytes`);
      console.log(`Ratio: ${(standaloneSize / regularTotal * 100).toFixed(2)}%`);
    });
  });
});