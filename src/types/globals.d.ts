// Minimal global declarations for legacy JS modules used in the codebase.
// These intentionally use `any` to allow incremental migration from JS -> TS
// without requiring full .d.ts files for every JS module.

declare module '*.js' {
  const value: any;
  export default value;
  export const __esModule: boolean;
}

// Commonly imported legacy modules (add more as needed)
declare module './rng.js' {
  export function srand(seed?: number): void;
  export function srandom(): number;
  export function srange(min: number, max: number): number;
  export function srangeInt(min: number, max: number): number;
}

declare module './config/assets/assetsConfig.js' {
  const Assets: any;
  export = Assets;
}

// Fallback for any other unknown relative imports (conservative any)
declare module '*/*' {
  const whatever: any;
  export default whatever;
}
