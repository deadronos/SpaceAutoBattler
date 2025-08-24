
<!--
SpaceAutoBattler — Copilot Quick Reference

This file tells the coding agent how to make safe, small, test-backed changes in the repository. Keep edits minimal, test-driven, and localized to TypeScript source in `/src` unless the task explicitly requires otherwise.
-->

# SpaceAutoBattler — Copilot Quick Reference

## Key rules (must follow)

- Edit only TypeScript files under `src/`. Do not modify generated JS build artifacts or files outside the source tree unless the user asks and gives explicit permission.
- All runtime state (simulation & renderer) must live on the canonical `GameState` type defined in `src/types/index.ts`. Do not introduce scattered module-level state.
- For any asset/visual work prefer the existing pooling helpers in `src/entities.ts` and the `assetPool` on `GameState` (textures/sprites/effects). Follow existing PoolEntry semantics when available.
- Use existing configuration helpers (for example `config/*`) rather than hard-coding values. Prefer `getDefaultBounds()` and renderer config values for layout and scale.
- Preserve determinism: the simulation uses seeded RNG (`src/rng.ts`) — don't break deterministic behavior in simulation code paths.

## Workflow & safety checklist

1. Plan the smallest change that solves the user's request.
2. Update or add TypeScript in `src/` only; keep the change minimal and well-scoped.
3. Add or update unit tests under `test/vitest/` for the change (happy path + 1-2 edge cases). Use the shared test helpers in `test/vitest/utils/` (e.g., `glStub`, `poolAssert`) where relevant.
4. Run the local checks:

```powershell
npx tsc --noEmit
npm test
```

5. Fix any TypeScript errors or failing tests before committing.
6. Update `spec/IMPLEMENTATION_STATUS.md` with a 1–2 line summary (what changed, where, and test status).

## Pooling & renderer guidance

- Renderer-owned transient visuals (explosions, flashes, particles) should use the renderer's pools: call `acquireEffect`/`releaseEffect` or `acquireSprite`/`releaseSprite` and reset on acquire.
- GPU resources (textures) must be created/released only on the main thread where GL context is available. If simulation runs in a worker, use a message/lease protocol to request renderer-side allocations.
- Per-key pool metadata (freeList, allocated, config, disposer) is now part of `GameState.assetPool` — use it to enforce per-key caps and invoke disposers (e.g., `gl.deleteTexture`) on trim/overflow.

## Tests & fixtures

- Shared test helpers live under `test/vitest/utils/` (e.g., `glStub.ts`, `poolAssert.ts`). Use them to write deterministic tests for pooling behaviors and GL-related logic.
- Add a small GL stub in tests to assert `createTexture` / `deleteTexture` call counts instead of calling a real WebGL context.

## PR & commit guidance

- Keep commits small and focused. Each PR should implement one measurable change (API + tests + docs if needed).
- PR description template:

1) Goal: one-line summary.
2) Files changed: list key files.
3) Tests: list tests added or updated and how to run them.
4) Validation: `npx tsc --noEmit` and `npm test` output summary (pass/fail).

---

## Maintainers

- Owner: deadronos
- Main branch: `main`


