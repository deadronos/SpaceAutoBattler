# src/utils/patchGltfLoader.ts

Path: src/utils/patchGltfLoader.ts
Last-Reviewed: 2025-09-21

Purpose: Runtime patch/compatibility wrapper for GLTFLoader and related three.js loaders. Ensures lazy import and compatibility with bundlers and R3F.

Key exports/symbols:

- patchGltfLoader (function applied at app bootstrap)

Notes:

- Used by `src/main.tsx` during initialization.
