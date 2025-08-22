// Helper declarations for incremental migration from .js -> .ts
// Allow importing existing JS modules (e.g. './rng.js') without TypeScript
// requiring explicit .d.ts files for each module. These are temporary and
// should be removed as files are ported to TypeScript.

declare module "*.js" {
  const value: any;
  export default value;
}

// Also allow bare imports that include the .js extension
declare module "*/**.js" {
  const value: any;
  export default value;
}
