import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
  include: ['test/**/*.js'],
  exclude: ['test/setupTests.js'],
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'test/setupTests.js'),
    globals: true,
    watch: false,
  },
});
