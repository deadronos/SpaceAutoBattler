// Shim module: transitional layer to rename `starDiskMaterial` -> `starMaterial`.
// This file re-exports the public API from the existing implementation so callers
// can move to the new module name incrementally. Remove this shim once all
// imports use `starMaterial` instead of `starDiskMaterial`.

export * from './starDiskMaterial.js';

// Keep the default export semantics (if any) by re-exporting as-is.
