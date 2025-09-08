import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'test/vitest/*.spec.ts',
      'test/vitest/*.test.ts',
      'test/vitest/**/*.spec.ts',
    ],
    exclude: [
      'test/playwright/**',
    ],
    environment: 'happy-dom',
    setupFiles: path.resolve(__dirname, 'test/vitest/setupTests.ts'),
    globals: true,
    watch: false,
    // Extend default timeout to reduce flakes when many tests run in parallel on CI/dev machines
    testTimeout: 20000,
    pool: 'threads',
    maxThreads: 24,
    threads: true, 
  },
});
