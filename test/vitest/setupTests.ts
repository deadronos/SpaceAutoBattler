import { mkdirSync } from 'fs';
import { resolve } from 'path';

try {
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
} catch {
  // best-effort; directory creation is only required for diagnostic logs
}

export {};
