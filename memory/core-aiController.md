
# Lightweight AI — current implementation (where to look)

The repository does not contain a `src/core/aiController.ts` file. The current, pragmatic AI implementation is a compact, simulation-integrated approach implemented in `src/game/systems.ts`. Key points:

- `src/game/systems.ts` implements `prepareShips` which: selects nearest enemy via `findNearestEnemy`, clamps movement to world bounds, orients ships, applies basic movement, handles per-ship weapon cooldowns, and calls `fireProjectile` when appropriate.
- Projectiles are advanced in `advanceProjectiles` and resolved in `resolveProjectiles` using TTL and distance-based collision checks.
- This implementation intentionally favors simplicity and determinism (uses `state.rng` for slight cooldown jitter) and is sufficient for the current game prototype.

## Design Reference (historical / future work)

The remainder of this file contains a design-level reference for a more feature-rich AIController (intents, formations, roaming anchors, caches, spatial-index integration). Keep these sections as a design reference if/when the AI is refactored into a dedicated controller module.

(Original design doc retained below — useful when expanding AI into its own module)

---

## Purpose

Short, searchable memory describing the responsibilities, key behavior, and interfaces of `src/core/aiController.ts`.

## Location

src/core/aiController.ts

## Summary

AIController is the central in-process AI manager for ship agents. It runs each tick against the canonical `GameState`, decides high-level intents for ships (roam, attack, evade, escort/formation, guard, carrier-specific behavior), and computes steering/turret outputs that are written back onto ship objects (typically into `ship.aiState` or directly to movement/aim targets). It combines high-level decision selection (personality + situation) with lower-level steering helpers and caches to scale to many agents.

... (original design doc preserved)

