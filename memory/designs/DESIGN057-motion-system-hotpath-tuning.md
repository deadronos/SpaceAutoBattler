# DESIGN057 — Motion System Hotpath Tuning

Status: Proposed
Date: 2025-11-16
Author: GitHub Copilot (agent)

## Context

Hot path: `updateMotionSystem` in `src/game/systems/motion/index.ts`.

- Called once per simulation step from `updateGame`.
- Iterates `state.queries.ships.entities` and updates angular motion, linear motion, and physics sync for every ship that has an AI command.
- Bridges into Rapier via `applyVelocityToPhysics`, which ultimately uses safe-kinematics wrappers.

With many active ships and multiple simulation substeps per frame, this loop becomes a dominant CPU cost.

## Findings

1. **Over-broad query:** The loop walks all ships in `state.queries.ships.entities` and filters per iteration with `if (!ship.ai?.command) continue;` rather than using a narrower archetype for ships that currently have commands.
2. **Potential per-ship allocations:** Depending on implementations of `updateAngularMotion`, `updateLinearMotion`, and `applyVelocityToPhysics`, per-iteration allocations (temporary vectors, quaternions) can add up quickly.
3. **Idle ships still touched:** Ships that have `ai` but no effective movement (e.g., zero thrust and turn) may still pass through motion math even though their state will not change.

## Requirements (EARS)

- WHEN updating motion each tick, THE SYSTEM SHALL only iterate ships that currently have an active AI command. (Acceptance: query size equals or is close to number of commanded ships.)
- WHEN computing motion for ships, THE SYSTEM SHALL avoid per-iteration allocations in the hot loop. (Acceptance: motion loop does not allocate new objects under steady load in profiling.)
- WHEN ships are effectively idle (no thrust, no turn), THE SYSTEM SHALL short-circuit motion updates where safe. (Acceptance: idle ships do not perform unnecessary math each tick.)

## Design: Narrowed Queries and Early-Outs

### Narrowed archetype

- Define a new Miniplex archetype in the game state setup (or a helper in the motion system) such as `shipsWithCommands` that indexes entities with `ship` and `ai.command` present.
- Update `updateMotionSystem` to iterate this narrower query instead of `state.queries.ships.entities`.
- If a dedicated archetype is not feasible, consider maintaining a small derived list of commanded ships in the decision system and reading from it here.

### Early-out for no-op commands

Inside the loop for each ship:

- Inspect the current command and ship motion parameters:
  - If thrust is near zero, no lateral/vertical thrust, and target heading is already within a tiny angular epsilon of current heading, skip `updateAngularMotion`, `updateLinearMotion`, and `applyVelocityToPhysics` for that ship.
- Keep epsilon thresholds in a small config so tuning can be done without touching the loop.

## Design: Allocation-Free Math

- Audit `angular.ts`, `linear.ts`, and `physicsSync.ts` to ensure they use shared temporaries only (no `new Vector3()` or `new Quaternion()` inside the per-ship loop).
- Centralize shared temporaries in `sharedTemps.ts` (already present) and add a short note in that module marking it as performance-critical.
- Avoid spreading or cloning large objects inside the loop; pass references and mutate in place where safe.

## Data and API Changes

- No change to `updateMotionSystem(state, dt)` signature.
- `GameState` may gain a new query (e.g., `queries.shipsWithCommands`) created alongside existing archetypes.
- Optional: add small motion config (`MOTION_EPSILON_CONFIG`) for idle detection thresholds.

## Validation Plan

- Add a unit/integration test that seeds a game state with a mix of commanded and idle ships and asserts that the narrowed query only touches commanded ships.
- Use a simple benchmark or profiling session to compare allocation counts and execution time before and after the change on a scenario with many ships and multiple substeps.

## Risks and Mitigations

- **Risk:** Over-aggressive early-outs might prevent tiny but intended motion changes. Mitigation: keep angular and thrust epsilons conservative and make them configurable; add tests for small maneuvers.
- **Risk:** Mistakes when wiring a new archetype could desync motion and other systems. Mitigation: keep archetype definition small and thoroughly tested, and default back to the full query if something goes wrong.
