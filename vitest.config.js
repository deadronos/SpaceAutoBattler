import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const glslLoaderPlugin = () => ({
  name: 'vitest-glsl-loader',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.glsl')) {
      return null;
    }

    const source = fs.readFileSync(id, 'utf-8');
    return {
      code: `export default ${JSON.stringify(source)};`,
      map: null,
    };
  },
});

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [glslLoaderPlugin()],
  assetsInclude: ['**/*.glb', '**/*.glsl'],
  resolve: {
    alias: {
      three: path.resolve(rootDir, 'node_modules/three'),
    },
  },
  test: {
    include: [
      'test/vitest/*.spec.ts',
      'test/vitest/*.test.ts',
      'test/vitest/**/*.spec.ts',
      'test/vitest/**/*.spec.tsx',
      'test/components/**/*.spec.ts',
      'test/components/**/*.spec.tsx',
      'test/utils/**/*.spec.ts',
    ],
    exclude: ['test/playwright/**'],
    environment: 'happy-dom',
    setupFiles: path.resolve(rootDir, 'test/vitest/setupTests.ts'),
    globals: true,
    watch: false,
    // Extend default timeout to reduce flakes when many tests run in parallel on CI/dev machines
    testTimeout: 20000,
    pool: 'threads',
    maxThreads: 24,
    threads: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
