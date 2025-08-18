import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  environment: 'jsdom',
  setupFiles: ['test/setupCanvas.js'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    include: ['src/**/*.js'],
  },
  },
});