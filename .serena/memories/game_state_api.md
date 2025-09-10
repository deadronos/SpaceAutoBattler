# GameState (overview)

Last-Reviewed: 2025-09-07

This memory provides a high-level overview of the `GameState` structure — the canonical runtime state object used across core, sim, and renderer.

## Key fields

- `time`: Simulation time in seconds.
- `ships`: Array of `Ship` entities.
- `projectiles`: Array of projectile entities.
- `assetPool`: Asset pool instance for ImageBitmaps, geometries.
- `spawnQueue`: Pending spawns for carriers/fleets.
- `rngSeed` / `rng`: Deterministic RNG seeded at simulation start.

## Usage

- All runtime mutations must happen on the central `GameState` object to preserve determinism and simplify serialization across worker boundary.

## Notes

- See `src/types/index.ts` for full TypeScript types.
