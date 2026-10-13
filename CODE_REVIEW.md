# Code Review — Findings Archive

> **Status banner (2026-10-13):** This is a historical audit record. Every finding below was re-verified against the current codebase on 2026-10-13 and is now resolved. Original descriptions are kept for context, followed by a `[RESOLVED]` note with current evidence or a corrected path.

## Findings (ordered by severity)

1. **[RESOLVED] High: Kill side-effects can fire multiple times in the same frame for the same ship**
   - `applyDamageResultToShip` triggers `onKill` whenever `hp <= 0`, without checking transition-to-dead (`src/game/combat/damage.ts:172`).
   - In `resolveProjectiles`, destroyed ships are only removed after all projectiles are processed (`src/game/systems/damage.ts:240`, `src/game/systems/damage.ts:343`).
   - Result: multiple projectiles in one tick can repeatedly call kill logic (XP/explosions/interrupts) for one ship.
   - **Current evidence:** `src/game/combat/damage.ts` is now a barrel re-export. The logic lives in `src/game/combat/damageApplication.ts`, which records `wasAlive` before mutation and only fires `callbacks?.onKill` on the alive→dead transition (`damageApplication.ts:79`, `damageApplication.ts:106-110`), so kill side-effects run once.

2. **[RESOLVED] High: Vitest config excludes 13 non-Playwright specs from CI/local unit runs**
   - Include globs only cover `test/vitest`, `test/components`, `test/utils` (`vitest.config.js:29`).
   - Missed specs include:  
     `test/simulationQueue.spec.ts`, `test/safeSnapshot.spec.ts`, `test/game/subsystems.spec.ts`, `test/game/progression.spec.ts`, `test/progression/*.spec.ts`, `test/config/*.spec.ts`, `test/renderer/*.spec.ts`.
   - This creates silent coverage gaps in core simulation, config, and renderer modules.
   - **Current evidence:** `vitest.config.js` no longer exists. The Vitest config now lives in `vite.config.ts` and includes all `test/**/*.{spec,test}.{ts,tsx}` except `test/playwright/**` (`vite.config.ts:416-417`). The previously missed specs now run.

3. **[RESOLVED] High: Two movement systems are active in the same tick path**
   - **Status**: Fixed - legacy `applyShipMovement` call removed from `executeAICommand`.
   - **Solution**: Motion system (`src/game/systems/motion/`) is now the sole authoritative movement path.
   - **Validation**: Added regression test (`test/vitest/dual-movement-regression.spec.ts`) ensuring exactly one physics write per ship per tick.
   - Previously: `prepareShips` called `executeAICommand`, which called legacy `applyShipMovement` (`src/game/systems/shipControl/index.ts:54`, `src/game/systems/shipControl/movementApply.ts:17`), and same frame then ran new motion system (`src/game/systems.ts:124`, `src/game/systems/motion/index.ts:42`), duplicating queued physics writes.

4. **[RESOLVED] Medium-High: AI scheduler drops backlog on long frames**
   - `processSchedulerTick` only consumes one interval even if accumulator is much larger (`src/game/systems/decision/scheduler.ts:88`, `src/game/systems/decision/scheduler.ts:107`).
   - Under frame stalls, AI decisions are skipped rather than caught up, making behavior frame-time dependent.
   - **Current evidence:** `src/game/systems/decision/scheduler.ts` now performs bounded catch-up, consuming multiple intervals per call while a backlog exists (`scheduler.ts:113-149`).

5. **[RESOLVED] Medium-High: Sensor update has cubic worst-case complexity**
   - Pairwise source/target loop (`src/game/systems/sensors.ts:123`, `src/game/systems/sensors.ts:134`) calls `computeOccluded`, which loops all ships again (`src/game/systems/sensors.ts:62`).
   - Effective complexity can approach O(N³), likely becoming a bottleneck as fleet size rises.
   - **Current evidence:** `src/game/systems/sensors.ts` now uses a `SpatialGrid` broad phase (`src/utils/spatialGrid.ts`) and queries occluders via `grid.hasOccluderOnSegment(...)` (`sensors.ts:96-110`) instead of scanning all ships per pair.

6. **[RESOLVED] Medium: Worker-render-only mode still initializes full main-thread simulation**
   - `GameProvider` always creates `GameState` and spawns fleets (`src/game/context.tsx:125`), even when main tick is disabled for worker-only render (`src/components/BattlefieldSystems.tsx:37`, `src/components/BattlefieldSystems.tsx:43`).
   - This adds unnecessary Rapier/ECS memory and startup cost.
   - **Current evidence:** The provider moved to `src/app/context.tsx` (old `src/game/context.tsx` is dead). It now derives `renderWorkerOnly` from `shouldRenderWorkerShipsOnly()` and only calls `spawnInitialFleets` when not render-only (`src/app/context.tsx:30-33`).

7. **[RESOLVED] Medium: Reset path leaves AI interrupt state and RNG continuity intact**
   - `resetGame` resets some AI/blackboard fields but does not clear interrupt queues/state (`src/game/resetGame.ts:17` onward).
   - Initial state contains interrupt maps and seeded RNG (`src/game/createGameState.ts:40`, `src/game/createGameState.ts:100`).
   - Can cause post-reset behavior carry-over and less reproducible “fresh match” semantics.
   - **Current evidence:** `src/game/resetGame.ts` now clears `ai.interrupts`/`ai.interruptState` maps, resets the RNG to `DEFAULT_GAME_SEED`, and clears blackboard/focus-fire/visibility state, giving deterministic fresh-match semantics.

8. **[RESOLVED] Medium: Hot-path target lookup is O(N) despite canonical map existing**
   - `getShipById` scans all ships (`src/game/systems/shipControl/aiExecutor.ts:30`) and is used for current target resolution each command (`src/game/systems/shipControl/aiExecutor.ts:92`).
   - `state.shipById` exists and is maintained (`src/game/createGameState.ts:29`, `src/game/ships.ts:100`).
   - **Current evidence:** `getShipById` now reads the canonical map: `state.shipById?.get(id) ?? null` (`src/game/systems/shipControl/aiExecutor.ts:29-31`).

9. **[RESOLVED] Low-Medium: Embedded turret execution path appears effectively dead**
   - Embedded turrets only run when global turret query is empty (`src/game/systems/shipControl/index.ts:29`).
   - Ship spawn creates turret entities from turret specs (`src/game/ships.ts:103`).
   - This makes fallback logic hard to trust/maintain.
   - **Current evidence:** The embedded fallback was removed. Turrets now run as a dedicated system in `src/game/systems/turrets.ts` over `state.queries.turrets` (`turrets.ts:37`).

10. **[RESOLVED] Low: Render-time object allocation in scene tree**
    - `new AxesHelper(200)` is created inside render JSX (`src/components/Battlefield.tsx:73`).
    - This can cause avoidable allocations/reconciliation churn.
    - **Current evidence:** The helper is created once via `useMemo(() => new AxesHelper(200), [])` with its lifecycle owned outside render (`src/components/Battlefield.tsx:109`).

## Architecture / Code Quality Notes

1. **Strong separation of concerns overall**
   - Clear modular split between simulation (`src/game/**`), rendering (`src/components/**`, `src/renderer/**`), and worker bridge (`src/worker/**`).
2. **Type discipline is mostly good, but several runtime escape hatches remain**
   - Some global-window debug surfaces remain in runtime paths (e.g. `src/components/Battlefield.tsx` reads `window.location.search` and `window.__copilot_*` debug flags), which increases long-term maintenance cost.
3. **Error-guard strategy is robust but can mask faults**
   - Subsystem guards record and continue (`src/game/systems/pipeline.ts:29-56`), and mutation wrappers swallow errors into diagnostics (`src/game/physics/mutationHelpers.ts:28`), which is good for uptime but can hide regressions if not aggressively monitored.

## Testing Gaps / Risks

1. **[RESOLVED]** Missing execution of 13 unit/spec files is the biggest immediate quality risk (see finding #2).
2. **[RESOLVED]** No obvious targeted test for “single kill side-effect per entity per tick” in projectile collision fan-in path — now covered by `test/vitest/duplicate-kill-side-effects.spec.ts` against the alive→dead transition guard in `damageApplication.ts`.
3. **[RESOLVED]** ~No obvious regression test enforcing one active movement pipeline (legacy vs motion system). — test/vitest/dual-movement-regression.spec.ts added.

## Execution Constraints

1. **[HISTORICAL]** Could not run `typecheck`/tests locally because toolchain dependencies are not installed in this environment (`tsc: command not found`). This was an environment artifact of the original review, not a repo issue; in this environment `pnpm run typecheck` and `pnpm test` run normally.
