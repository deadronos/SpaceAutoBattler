# core-aiController.md

## Purpose

Short, searchable memory describing the responsibilities, key behavior, and interfaces of `src/core/aiController.ts`.

## Location

src/core/aiController.ts

## Summary

AIController is the central in-process AI manager for ship agents. It runs each tick against the canonical `GameState`, decides high-level intents for ships (roam, attack, evade, escort/formation, guard, carrier-specific behavior), and computes steering/turret outputs that are written back onto ship objects (typically into `ship.aiState` or directly to movement/aim targets). It combines high-level decision selection (personality + situation) with lower-level steering helpers and caches to scale to many agents.

## Key Responsibilities

- Iterate ships each simulation tick and update AI state and commands.
- Decide intents using environment signals (nearby enemies/friends, carrier presence, health, personality) and configuration from `behaviorConfig`.
- Execute intent handlers that compute movement targets, turret aims, formation slots, roaming anchors, and weapon firing decisions.
- Provide steering calculations: separation, pursuit, evade, arrival, formation offsets.
- Maintain caches and registries to reduce CPU work:
  - `sepCache` for separation force reuse per tick
  - `roamingAnchors` map per team to manage anchor ownership
  - Formation slot assignments stored in `ship.aiState`
- Integrate spatial index when enabled (uses `state.spatialGrid` for neighbor queries) and fall back to linear searches otherwise.

## Important Data & Fields

- state: reference to canonical GameState (read/write)
- roamingAnchors: Map<team, Anchor[]> used to allocate and reuse roaming anchors
- sepCache: per-ship separation cache keyed by ship id and tick
- Decision & behavior config reads from `state.behaviorConfig` and `state.simConfig` for bounds
- Uses `state.rng` for deterministic randomness in placements

## Primary Functions / Methods (not exhaustive)

- updateAll(dt): main loop to step AI per tick (evaluate, select, and execute intents)
- processShip(ship): compute and apply AI for a single ship
- selectIntentForShip(ship): returns an intent object/name based on personality, nearby enemies, health, carrier presence, etc.
- executeIntent\_<intentName>(ship, intent): many specialized handlers (roam, attack, evade, formation/escort, guard, carrier behavior)
- steeringSeparation/steering helpers: compute separation forces using `state.spatialGrid` or linear fallback
- assignRoamingAnchor(ship): picks and registers an anchor location for roaming ships (ensures min separation from other anchors and stays within sim bounds)
- findBestFormation(ship): looks for carriers or friendly groups to form with, returns formation config or null
- assignFormationSlot(ship, formationName, formationConfig, center): deterministic slot assignment (based on ship id mod slotCount)
- getFormationCenter / calculateGroupCenter: helpers to compute formation centers
- getNearbySeparationShipsLinear: linear neighbor fallback helper (delegates to shared util)

## Spatial Index & Fallbacks

- If `state.spatialGrid` is present and `behaviorConfig.globalSettings.enableSpatialIndex` is true, AI uses neighbor queries via the spatial grid for separation and neighbor searches.
- When spatial index is not available, AI falls back to linear scans (slower but correct).

## Integration Points

- Writes movement targets and `aiState` fields onto Ship objects so render/physics/weapon systems can act.
- Reads `state.ships`, `state.tick`, `state.behaviorConfig`, `state.simConfig`, `state.rng`.
- Collaborates with `DecisionEngine` and `IntentManager` (if present) for higher-level heuristics.
- Uses shared steering utilities in `src/utils` (e.g., `steeringSeparation`) and global helpers (e.g., `sharedGetNearbySeparationShipsLinear`, `sharedGetDistance`).

## Configuration Flags & Tunables

Most behavior is driven from `state.behaviorConfig`:

- globalSettings: separationDistance, formationSearchRadius, formationMinGroupSize, roamingAnchorMaxAttempts, roamingAnchorMinSeparation, evadeDistance, and others
- roamingPatterns, formations definitions, personality multipliers

## Performance Notes

- `sepCache` reduces repeated separation calculations within the same tick for the same ship.
- Spatial grid neighbor queries are preferred for large numbers of agents to avoid O(n^2) neighbor searches.
- Formation slot assignment is cheap and deterministic; anchor assignment includes bounded retries to avoid pathological loops.

## Edge Cases & Fallbacks

- Anchor assignment has bounded attempts and a fallback placement relative to existing anchors.
- Formation logic falls back to a default formation if specific named formation is missing.
- Steering falls back to linear neighbor collection when spatial grid is not enabled.

## How to Use / Where to Look

- Entry point: AIController is instantiated/used from the main simulation update path (see `src/core/gameState.ts` and `src/main.ts`).
- To change high-level behavior, update `src/config/behaviorConfig.ts` and the formations/roaming patterns inside it.
- For debugging: inspect `ship.aiState` at runtime to see assigned formation slots, roamingAnchor, and current intent.

## Next Steps / Suggested Follow-ups

- Create a small unit/behavior test for `assignRoamingAnchor` to validate anchor spacing and bounds.
- Add instrumentation around `sepCache` and spatial grid hits/misses to decide if the cache parameters are tuned correctly.
- Document exact intent names and payload shape if `IntentManager` is later made into a serialized protocol.

## References

- src/core/aiController.ts (primary source)
- src/config/behaviorConfig.ts (tuning values)
- src/core/gameState.ts (where AIController is called)
- shared steering helpers in utils/sharedSteering (helpers used by AIController)
