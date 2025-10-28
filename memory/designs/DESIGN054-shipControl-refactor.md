# DESIGN054 — Ship Control / AI Execution Refactor

Status: Proposed
Date: 2025-10-28
Author: GitHub Copilot (agent)

Summary

Refactor `src/game/systems/shipControl.ts` into smaller modules that separate AI command execution (decision), movement application (kinematic updates), weapon firing & metrics, and safety/guard code for missing AI. The goal is improved clarity between "decide what to do" and "apply the decision", easier unit testing of AI decisions, and safer encapsulation of kinematic updates.

Problem

`shipControl.ts` currently contains:
- High-level per-ship lifecycle (`prepareShips`) that updates cooldowns, regen and calls `executeAICommand`.
- `executeAICommand` mixing heading normalization, thrust clamping, kinematic translation deltas via `deferSetNextKinematicTranslation`, and firing behavior (muzzle flash, firing metrics, `fireProjectile`).
- Helper functions and global bookkeeping for missing AI.

This coupling makes it harder to test AI decision logic independently of physics and to reuse movement application (for example when moving to a purely physics-driven implementation).

Goals

- Separate the pure decision logic (heading normalization, clamp to max turn per tick, choose to fire) from the side-effectful movement application (deferSetNextKinematicTranslation), and from weapons/metrics.
- Keep `prepareShips` as the canonical per-frame entry point but implement it by coordinating smaller modules.
- Improve test coverage of `executeAICommand` decision logic.

Design

Create folder `src/game/systems/shipControl/`:
- `index.ts` — export `prepareShips` and maintain public API.
- `aiExecutor.ts` — implement pure aspects of `executeAICommand` that compute the final `command` (heading, thrust, firePrimary decisions) and return a small `Decision` object describing movement and fire intents.
- `movementApply.ts` — given a `Decision` and `ship`, perform the `deferSetNextKinematicTranslation` plus any clampToWorld logic.
- `weapons.ts` — handle muzzle flash creation, call `fireProjectile`, and record metrics; isolate firing side-effects here.
- `lifecycle.ts` — refill cooldowns, update captain abilities, shield regen and turret embedded handling; `prepareShips` orchestrates lifecycle -> decision -> movement -> weapons.
- `aiSafety.ts` — `ensureAiEnabled`, `handleMissingAi`, and `missingAiShips` bookkeeping.

Interfaces

- `aiExecutor` returns a plain object (Decision) describing final heading Vector3, thrust scalar, and firePrimary boolean. This object is small and easily unit tested.
- `movementApply` consumes Decision and uses `deferSetNextKinematicTranslation`.
- Existing callers continue to call `prepareShips(state, delta)` without change.

Testing

Add tests under `test/systems/shipControl/`:
- `aiExecutor.spec.ts` — feed example ship transforms and commands, assert returned Decision respects max-turn clamping and normalized heading.
- `movementApply.spec.ts` — mock `deferSetNextKinematicTranslation` to assert correct next positions for a variety of thrust values.
- `weapons.spec.ts` — mock `fireProjectile` and validate muzzle flash creation and cooldown updates.

Migration plan (incremental)

1. Create new folder and files under `src/game/systems/shipControl/` and re-export from a shim `shipControl.ts` that delegates to `shipControl/index.ts`.
2. Implement `aiExecutor` with identical logic but returning Decision object instead of directly applying movement.
3. Implement `movementApply` to perform the deferred physics calls.
4. Update `prepareShips` to use new modules in sequence; run type-check and tests.
5. Add unit tests for aiExecutor and movementApply.
6. Remove original combined logic once tests and smoke runs pass.

Acceptance criteria

- Public API unchanged: `prepareShips(state, delta)` still works and tests pass.
- Decision logic is covered by unit tests.
- Movement application isolated; weapon firing encapsulated.

Risks and mitigations

- Risk: timing/order of side-effects (cooldown/regen -> fire) could change subtly. Mitigate by preserving ordering and adding integration smoke tests.
- Risk: small numeric differences when copying heading normalization. Mitigate by keeping math identical and adding unit tests.

Files touched (planned)

- Add: `src/game/systems/shipControl/index.ts`
- Add: `src/game/systems/shipControl/aiExecutor.ts`
- Add: `src/game/systems/shipControl/movementApply.ts`
- Add: `src/game/systems/shipControl/weapons.ts`
- Add: `src/game/systems/shipControl/lifecycle.ts`
- Add: `src/game/systems/shipControl/aiSafety.ts`
- Keep: `src/game/systems/shipControl.ts` as a shim until migration completes.

