## Findings (ordered by severity)

1. **High: Kill side-effects can fire multiple times in the same frame for the same ship**
   - `applyDamageResultToShip` triggers `onKill` whenever `hp <= 0`, without checking transition-to-dead (`src/game/combat/damage.ts:172`).
   - In `resolveProjectiles`, destroyed ships are only removed after all projectiles are processed (`src/game/systems/damage.ts:240`, `src/game/systems/damage.ts:343`).
   - Result: multiple projectiles in one tick can repeatedly call kill logic (XP/explosions/interrupts) for one ship.

2. **High: Vitest config excludes 13 non-Playwright specs from CI/local `npm test`**
   - Include globs only cover `test/vitest`, `test/components`, `test/utils` (`vitest.config.js:29`).
   - Missed specs include:  
     `test/simulationQueue.spec.ts`, `test/safeSnapshot.spec.ts`, `test/game/subsystems.spec.ts`, `test/game/progression.spec.ts`, `test/progression/*.spec.ts`, `test/config/*.spec.ts`, `test/renderer/*.spec.ts`.
   - This creates silent coverage gaps in core simulation, config, and renderer modules.

3. **~High: Two movement systems are active in the same tick path~ [RESOLVED]**
   - **Status**: Fixed - legacy `applyShipMovement` call removed from `executeAICommand`.
   - **Solution**: Motion system (`src/game/systems/motion/`) is now the sole authoritative movement path.
   - **Validation**: Added regression test (`test/vitest/dual-movement-regression.spec.ts`) ensuring exactly one physics write per ship per tick.
   - Previously: `prepareShips` called `executeAICommand`, which called legacy `applyShipMovement` (`src/game/systems/shipControl/index.ts:54`, `src/game/systems/shipControl/movementApply.ts:17`), and same frame then ran new motion system (`src/game/systems.ts:124`, `src/game/systems/motion/index.ts:42`), duplicating queued physics writes.

4. **Medium-High: AI scheduler drops backlog on long frames**
   - `processSchedulerTick` only consumes one interval even if accumulator is much larger (`src/game/systems/decision/scheduler.ts:88`, `src/game/systems/decision/scheduler.ts:107`).
   - Under frame stalls, AI decisions are skipped rather than caught up, making behavior frame-time dependent.

5. **Medium-High: Sensor update has cubic worst-case complexity**
   - Pairwise source/target loop (`src/game/systems/sensors.ts:123`, `src/game/systems/sensors.ts:134`) calls `computeOccluded`, which loops all ships again (`src/game/systems/sensors.ts:62`).
   - Effective complexity can approach O(N³), likely becoming a bottleneck as fleet size rises.

6. **Medium: Worker-render-only mode still initializes full main-thread simulation**
   - `GameProvider` always creates `GameState` and spawns fleets (`src/game/context.tsx:125`), even when main tick is disabled for worker-only render (`src/components/BattlefieldSystems.tsx:37`, `src/components/BattlefieldSystems.tsx:43`).
   - This adds unnecessary Rapier/ECS memory and startup cost.

7. **Medium: Reset path leaves AI interrupt state and RNG continuity intact**
   - `resetGame` resets some AI/blackboard fields but does not clear interrupt queues/state (`src/game/resetGame.ts:17` onward).
   - Initial state contains interrupt maps and seeded RNG (`src/game/createGameState.ts:40`, `src/game/createGameState.ts:100`).
   - Can cause post-reset behavior carry-over and less reproducible “fresh match” semantics.

8. **Medium: Hot-path target lookup is O(N) despite canonical map existing**
   - `getShipById` scans all ships (`src/game/systems/shipControl/aiExecutor.ts:30`) and is used for current target resolution each command (`src/game/systems/shipControl/aiExecutor.ts:92`).
   - `state.shipById` exists and is maintained (`src/game/createGameState.ts:29`, `src/game/ships.ts:100`).

9. **Low-Medium: Embedded turret execution path appears effectively dead**
   - Embedded turrets only run when global turret query is empty (`src/game/systems/shipControl/index.ts:29`).
   - Ship spawn creates turret entities from turret specs (`src/game/ships.ts:103`).
   - This makes fallback logic hard to trust/maintain.

10. **Low: Render-time object allocation in scene tree**
    - `new AxesHelper(200)` is created inside render JSX (`src/components/Battlefield.tsx:73`).
    - This can cause avoidable allocations/reconciliation churn.

## Architecture / Code Quality Notes

1. **Strong separation of concerns overall**
   - Clear modular split between simulation (`src/game/**`), rendering (`src/components/**`, `src/renderer/**`), and worker bridge (`src/worker/**`).
2. **Type discipline is mostly good, but several runtime escape hatches remain**
   - Repeated `as any` and global-window debug surfaces in runtime paths (`src/game/context.tsx:134`, `src/components/Battlefield.tsx:93`) increase long-term maintenance cost.
3. **Error-guard strategy is robust but can mask faults**
   - Subsystem guards record and continue (`src/game/systems.ts:73`), and mutation wrappers swallow errors into diagnostics (`src/game/physics/mutationHelpers.ts:28`), which is good for uptime but can hide regressions if not aggressively monitored.

## Testing Gaps / Risks

1. Missing execution of 13 unit/spec files is the biggest immediate quality risk (see finding #2).
2. No obvious targeted test for “single kill side-effect per entity per tick” in projectile collision fan-in path.
3. ~No obvious regression test enforcing one active movement pipeline (legacy vs motion system). [RESOLVED - test/vitest/dual-movement-regression.spec.ts added]

## Execution Constraints

1. Could not run `typecheck`/tests locally because toolchain dependencies are not installed in this environment (`tsc: command not found`).
