# src/renderer/materialRegistry.tsx

Path: src/renderer/materialRegistry.tsx
Last-Reviewed: 2025-09-21

Purpose: Registers and provides shared Three.js materials (shields, hull, projectile trails) to renderer components.

Key exports/symbols:
- registerMaterials
- useMaterial (hook)

Notes:
- Dispose materials you create; prefer re-use and instancing.
