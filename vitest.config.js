import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'test/vitest/**/*.spec.ts',
      'test/vitest/**/*.test.ts',
    ],
    exclude: [
      'test/playwright/**',
    ],
  environment: 'happy-dom',
    setupFiles: path.resolve(__dirname, 'test/vitest/setupTests.ts'),
    globals: true,
    watch: false,
  },
});
