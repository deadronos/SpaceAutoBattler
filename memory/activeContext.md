# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Validate gameplay after 2025 rewrite (branch `feat-shipstats`): main-thread Rapier + R3F step, Miniplex ECS.
- Improve unit test coverage for AI targeting/movement and projectile resolution.
- Maintain canonical `GameState` and avoid module-level side effects.

Recent changes:

- Rewrote `/src` from scratch; Rapier stepped inside R3F `useFrame`, no worker.
- Added material registry with built-in shield and bullet materials.
- Introduced per-hull shield visuals in `src/config/renderer.ts`.

Next steps:

- Run full test suite and ensure `npm run typecheck` passes on CI.
- Add targeted unit tests for `systems.ts` (nearest-target, damage application, shield ripple emission).
- Add a small deterministic tick helper for tests (mirrors E2E window hooks).

Generated: 2025-09-21
