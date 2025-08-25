Title: Implement teamCounts caching and sync (avoid per-frame ship filtering)
Date: 2025-08-25
Branch: deadronos/issue28

Summary
-------
This PR implements a cached per-team ship counter on the canonical `GameState`
to avoid allocating temporary arrays in the UI hot-path. The change keeps
`teamCounts` in sync whenever ships are created, removed, or change teams. It
also ensures worker snapshots rebuild `teamCounts` so the main thread remains
consistent.

Files touched
------------
- src/types/index.ts — made `teamCounts` a required field on `GameState`.
- src/entities.ts — initialize `teamCounts` in `makeInitialState` and added
  `updateTeamCount(state, oldTeam?, newTeam?)` helper.
- src/gamemanager.ts — include `teamCounts` in snapshots and call
  `updateTeamCount` on spawn/snapshot paths.
- src/simulate.ts — decrement `teamCounts` when ships are removed/killed.
- src/simWorker.ts — increment `teamCounts` on `spawnShip` and rebuild counts
  on `setState`.
- src/main.ts — UI `uiTick()` now reads `state.teamCounts` instead of
  filtering `state.ships` each frame.

Tests added
-----------
- test/vitest/teamcounts.spec.ts — verifies main-thread spawn/removal and
  worker-snapshot rebuild keep `teamCounts` consistent.
- test/vitest/team-switch.spec.ts — verifies `updateTeamCount()` handles team
  reassignment correctly.

Validation
----------
- Type-check: `npx tsc --noEmit` — OK (no errors)
- Tests: Vitest full suite — 114 passed, 0 failed (local run on branch)

How to review
-------------
1. Run `npx tsc --noEmit` to confirm no type errors.
2. Run the Vitest tests (`npm test` or `npx vitest`) and inspect the two new
   tests in `test/vitest/`.
3. Inspect `src/entities.ts` for the authoritative `updateTeamCount` implementation
   and follow call sites in `src/gamemanager.ts` and `src/simulate.ts`.

Team-counts caching implementation (deadronos/issue28)
===============================================

Summary

This change implements a cached per-team ship count on the canonical GameState
(`teamCounts`) to avoid allocating temporary arrays in the UI hot-path. The
value is updated whenever ships are created, removed, or change teams. Worker
snapshots rebuild `teamCounts` when a full snapshot is applied so the main
thread remains consistent.

Files changed

- `src/types/index.ts` — `GameState.teamCounts` made required
- `src/entities.ts` — `makeInitialState()` initializes `teamCounts`; exported
  `updateTeamCount()` helper
- `src/gamemanager.ts` — snapshot includes `teamCounts`; spawn & snapshot
  handlers keep counts in sync
- `src/simulate.ts` — removal paths decrement counts
- `src/simWorker.ts` — spawn & setState handlers update/rebuild counts
- `src/main.ts` — UI `uiTick()` reads `state.teamCounts` instead of filtering
  `state.ships`

Tests

- `test/vitest/teamcounts.spec.ts` — validates spawn/removal and snapshot
  rebuild behavior
- `test/vitest/team-switch.spec.ts` — validates team re-assignment increments/
  decrements as expected

Validation

- Type-check: `npx tsc --noEmit` — success
- Tests: Vitest full suite — 114 passed, 0 failed

Notes

- Centralized count mutation logic in `updateTeamCount(state, oldTeam?, newTeam?)`.
- Worker snapshots rebuild `teamCounts` from `state.ships` to avoid desyncs.


Next steps

- If CI enforces markdownlint, run the linter and apply any remaining small
  formatting fixes; docs were updated in this branch.
- Open a PR from branch `deadronos/issue28` including this summary and changed
  files.

