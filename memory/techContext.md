# Tech Context — SpaceAutoBattler

Tech stack and notable dependencies:

- TypeScript (strict) — source in `src/` and unit tests in `test/vitest` (Vitest).
- Three.js — rendering; prefer Three.js abstractions (Object3D, Mesh) and always dispose resources.
- Rapier3D — deterministic physics in the worker (`src/simWorker.ts`).
- Vitest — unit testing framework. Tests are deterministic and fast.
- Build tooling: npm scripts, esbuild/webpack (see `scripts/` and `webpack.config.mjs`).

Developer workflow notes:

- Typecheck with `npx tsc --noEmit` and run `npm test` before committing.
- Use the project's config files in `src/config` for tuning.

Generated: 2025-09-15
