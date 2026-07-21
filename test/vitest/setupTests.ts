import { mkdirSync } from 'fs';
import { resolve } from 'path';

try {
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
} catch {
  // best-effort; directory creation is only required for diagnostic logs
}

// Suppress duplicate THREE warning in happy-dom test environment
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple instances of Three.js being imported')) {
      return;
    }
    originalWarn(...args);
  };
}

export {};

