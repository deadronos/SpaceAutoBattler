# src/assets/ships.ts

Path: src/assets/ships.ts
Last-Reviewed: 2025-09-21

Purpose: Maps ship classes to GLTF asset URLs and small metadata like scale/rotation overrides.

Key exports/symbols:

- SHIP_ASSETS (mapping from ship type to asset path)

Notes:

- Assets are referenced by renderer-only code; simulation uses ship class names only.
