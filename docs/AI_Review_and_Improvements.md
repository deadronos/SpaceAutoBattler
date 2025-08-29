AI Review and Improvement Proposals
===================================

This document summarizes a code review of the AI system and related configurations in the SpaceAutoBattler repo, identifies strengths and likely issues (including causes of clumping and naive evasion), and proposes three actionable improvements with implementation guidance.

Date: 2025-08-29

Files reviewed
--------------
- `src/core/aiController.ts`
- `src/config/behaviorConfig.ts`
- `src/core/gameState.ts`
- `src/config/entitiesConfig.ts`

High-level summary
------------------
- The repository separates configuration from runtime AI logic and provides a good variety of configurable behaviors (personalities, turret configs, roaming patterns, formations). The `AIController` implements a clean intent-based behavior model and turret scoring. Roaming patterns and formation configs are first-class, which is good for extensibility.

- However, there are duplication and design conflicts: `src/core/gameState.ts` contains `stepShipAI` and other movement/targeting logic that overlap with `AIController`. This risks two sources of behavior causing unexpected results.

- The main gameplay issues observed (and explained below) are: clumping of ships, naive evade behavior, overlapping patrol anchors, and limited use of recent damage information when deciding to retreat/evade.

What's done well
----------------
- Config-driven design: `BehaviorConfig` exposes many tuning knobs (personalities, turret config, roaming patterns, formations), making behavior tuning accessible without code edits.
- Clear intent/state model: `AIController` uses AI intents (pursue/evade/strafe/group/patrol/retreat) and stores per-ship `aiState` for intent timing and roaming patterns.
- Modular turret design: turret AI can be independent or synchronized and uses a scoring function based on distance, health and level.
- Repeatable randomness: RNG is seeded from the sim config.
- Formation and roaming patterns are implemented as configurable entities rather than baked logic.

Key problems and likely bugs (affecting clumping, evasion, roaming, damage response)
-----------------------------------------------------------------------------------
1. Duplicate/inconsistent AI logic
   - `AIController` and `gameState.ts` both contain AI/steering logic; this can create conflicting movement/targeting results. Pick a single authoritative AI code path.

2. Clumping
   - Group behavior moves ships to the center of nearby friends without any separation force. That causes clustering, including in formations and patrols.
   - Formation slot allocation is not explicit. Multiple ships can aim for the same formation position.

3. Naive Evade
   - `executeEvade` simply moves directly away from the nearest threat by a fixed amount. No consideration of boundaries, friendly collisions, or incoming fire vectors. No sampling of alternative directions.

4. Roaming anchors are local
   - Patrol targets are created relative to `ship.pos`, leading each ship to pick overlapping areas if they start together. There's no global/per-team roaming anchor allocation.

5. Incomplete use of damage info
   - The simulation logs shield hit direction and times for visuals, but no `recentDamage` accumulator is used to bias behavior (e.g., force immediate retreat or evasive maneuvers if a ship was hit badly in the last n seconds).

6. Magic numbers and hard-coded distances
   - Evade distance (100), close threshold (10), and other numbers are embedded in code rather than config, reducing tunability.

Actionable improvements (3 medium→high impact)
-----------------------------------------------
The following three improvements are prioritized for impact, ease of implementation, and safety.

1) Separation steering (reduce clumping)
---------------------------------------
- Impact: High — immediate reduction in pile-ups and more natural group movement.
- Difficulty: Low→Medium — small changes in `AIController` movement logic and config.

What to change
- Add separation parameters to `BehaviorConfig` (e.g., `separationDistance`, `separationWeight`).
- In `src/core/aiController.ts`, augment `moveTowards` (or add `applySeparationForce`) so movement direction = normalized( desiredDir + separationVec * separationWeight ).
- Compute `separationVec` by summing the inverse-distance weighted offsets away from nearby friends (within `separationDistance`). Normalize and scale.
- Respect formation spacing: use a formation's `spacing` as a preferred separationDistance when in a formation.

Notes on tuning
- Keep separationWeight small relative to cohesion so formations and group movement remain functional (e.g., separationWeight 0.6, cohesion 0.8). Make these tunable in `BehaviorConfig`.

2) Smarter Evade with damage-weighted intent switching
-----------------------------------------------------
- Impact: High — ships will survive longer, escape dangerous situations intelligently, and not run predictably into walls or friendly clusters.
- Difficulty: Medium — requires state tracking for recent damage and a sampling assay for escape directions.

What to change
- Track `recentDamage` (a decaying accumulator) on `ship.aiState`. When bullets apply damage (in `updateBullets` or damage handling), add to `recentDamage` and set `lastDamageTime`.
- Add config fields: `damageEvadeThreshold`, `damageDecayRate`, `evadeSamplingCount`, `evadeDistance`.
- In `reevaluateIntent`, bias decisions: if `recentDamage` > `damageEvadeThreshold` prefer `evade` (or `retreat`) for a duration.
- Replace `executeEvade` with a sampled escape: generate N candidate headings (e.g., 8–12). For each candidate project a target point (ship.pos + dir * evadeDistance) and score by:
  - distance to nearest enemy in that direction (higher is better)
  - distance to boundaries (prefer not to run into walls)
  - distance to nearest friendly (avoid collisions)
  - optionally predicted incoming bullets (dot-product test) to avoid firing axes.
- Choose the highest-scoring candidate and move toward it.

Notes on performance
- Keep sample count low (8) for good behavior/low CPU usage. Cache expensive nearest-neighbor checks with limited radius.

3) Anchored roaming + formation slot assignment
----------------------------------------------
- Impact: Medium — reduces overlapping patrol anchors and creates stable formation slots so ships don't fight for the same spot.
- Difficulty: Medium

What to change
- Roaming anchors:
  - When entering `roaming` mode, assign `aiState.roamingAnchor` chosen from a distributed pool (per-team). Use a simple grid/poisson-disc approach or choose a random point and reject if too close to existing anchors.
  - `executePatrol` should orbit/move around `aiState.roamingAnchor` instead of `ship.pos`.
  - When anchor is released (ship leaves roaming or idle > timeout), free it.
- Formation slot assignment:
  - When `findBestFormation` returns a formation, compute slot positions for members up to `formation.maxSize` and assign nearest unclaimed slot to each ship.
  - Store `aiState.formationSlotIndex` and `aiState.formationPosition` so ships have unique targets.

Tuning
- Use formation `spacing` config for slot distances. Keep a short lock-time on slots to prevent constant reshuffling.

Extra short-term improvements
- Use `leadPredictionTime` when firing bullets (aim at predicted target.pos + vel * leadTime).
- Penalize target score if many allies already target the same ship (to reduce overkill).
- Make magic numbers configurable in `BehaviorConfig`.

Implementation hints and file pointers
-------------------------------------
- `src/core/aiController.ts`:
  - moveTowards() -> apply separation (or call helper applySeparationForce()).
  - reevaluateIntent() -> check `ship.aiState.recentDamage` and bias to `evade`.
  - executeEvade() -> implement escape sampling and scoring.
  - chooseRoamingIntent()/executePatrol() -> use `aiState.roamingAnchor`.
  - findBestFormation() -> compute and reserve formation slots.

- `src/core/gameState.ts`:
  - Decide which AI path to keep. If `AIController` is preferred, remove/merge `stepShipAI` to avoid conflicts.
  - In bullet collision/damage handling, add damage to `ship.aiState.recentDamage` (create `aiState` if not present).

- `src/config/behaviorConfig.ts`:
  - Add new tuning params: separationDistance, separationWeight, damageEvadeThreshold, damageDecayRate, evadeSamplingCount, evadeDistance, roamingAnchorMinSeparation.

Testing & validation
--------------------
- Unit tests:
  - Add `ai-behavior.spec.ts` tests to validate separation reduces neighbor counts and that `recentDamage` leads to `evade` intent when threshold exceeded.
- Smoke tests:
  - Spawn a cluster of fighters and run the sim for a few seconds to confirm ships spread and use anchors.

Quality & tradeoffs
-------------------
- Separation makes formations looser; tune cohesion vs separation.
- Sampled evasion costs CPU; keep sampling low.
- Merging AI paths requires some refactor but prevents conflicts and simplifies future features.

Next steps (suggested ordering)
-------------------------------
1. Implement separation steering in `AIController` and add config params. This is a low-risk change with visible improvements.
2. Add `recentDamage` tracking and damage-weighted intent switching with a modest sampled evade routine.
3. Add anchored roaming and formation slot assignment.

Appendix — Suggested new config keys (defaults)
-----------------------------------------------
Add to `BehaviorConfig.globalSettings` or a new subsection `movement`:
- `separationDistance`: 80
- `separationWeight`: 0.6
- `damageEvadeThreshold`: 15 // damage units
- `damageDecayRate`: 1.0 // per second (exponential/linear decay permitted)
- `evadeSamplingCount`: 8
- `evadeDistance`: 120
- `roamingAnchorMinSeparation`: 150


---

End of review

If you want I can implement the first item (separation steering) now and run project tests. Which item should I implement first? (I recommend starting with separation steering.)
