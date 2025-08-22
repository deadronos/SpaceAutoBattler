// Minimal ambient declarations to ease JS -> TS migration without
// suppressing real type errors across the codebase. Prefer targeted shims
// over broad fallbacks. Keep this file intentionally small.

// Allow importing legacy .js modules with an `any` default export.
// Only matches files explicitly imported with a .js suffix.
declare module '*.js' {
  const value: any;
  export default value;
}

// If additional legacy modules require shape hints, declare them explicitly
// below rather than using a broad catch-all. Example template:
// declare module './path/to/legacyModule.js' {
//   export function someFn(arg: string): number;
// }

// Node testing shims (very light) — uncomment if tests need them in TS files
// declare const __DEV__: boolean;
