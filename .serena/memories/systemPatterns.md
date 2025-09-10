## System Patterns

Last-Reviewed: 2025-09-07

Key architectural patterns used in the repo:

- Canonical `GameState` for all runtime state.
- Worker for deterministic physics (`simWorker.ts`) with packed Float32Array transfers.
- Renderer uses instancing and an `assetPool` for shared geometries/materials.
- Config-driven behavior: all balance and AI parameters in `src/config`.

Design rationale:

- Determinism simplifies replay and testing.
- Asset pooling reduces GPU overhead and garbage collection pressure.
