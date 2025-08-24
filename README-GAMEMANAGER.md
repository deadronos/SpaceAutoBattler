
# GameManager Overview

The GameManager coordinates simulation, rendering, and UI for SpaceAutoBattler. All state is centralized in the canonical `GameState` type (`src/types/index.ts`).

## Key Concepts

- **Canonical GameState**: All simulation, rendering, and UI state is a property of `GameState`.
- **Deterministic simulation**: Uses seeded RNG (`src/rng.ts`) for reproducible results.
- **Serialization**: GameState can be serialized/deserialized for replay, debugging, and determinism validation.

## Subsystem Interaction

- **Simulation**: Accepts and mutates `GameState`.
- **Renderer**: Renders only from `GameState`.
- **UI**: Reads and updates `GameState`.

## Contributor Notes

- All new code and tests must use the canonical `GameState` for state access and mutation.
- For replay/determinism, use serialization helpers and validate with test cases.

## Development notes

- Edit `src/gamemanager.ts` for behavior changes.
- Build with `npm run build` or `npm run build-standalone` to generate the bundles.
- The build process is implemented in `scripts/build.mjs` and `scripts/build-standalone.mjs` and uses only TypeScript sources.
