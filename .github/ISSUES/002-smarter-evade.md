# Smarter Evade: damage-weighted intent switching and sampled escape directions

Labels: enhancement, ai, high-impact

State now
---------
- `AIController.executeEvade` moves directly away from the nearest threat by a fixed vector; `reevaluateIntent` does not consider recent accumulated damage.
- Damage events record visual data on shield hits but there is no `recentDamage` accumulator to drive behavior.

Expected outcome
----------------
- Ships that receive a burst of damage in a short time will bias towards `evade` or `retreat` for a configurable duration.
- Evade uses sampled candidate escape headings and scores them on safety (distance from enemies, distance from boundaries, avoidance of friend collisions and incoming bullets), then selects the best.

Acceptance criteria
-------------------
1. Add `ship.aiState.recentDamage` and `lastDamageTime` updates when damage is applied.
2. Add config keys in `BehaviorConfig` for `damageEvadeThreshold`, `damageDecayRate`, `evadeSamplingCount`, `evadeDistance`.
3. `reevaluateIntent` prefers `evade` if `recentDamage` exceeds `damageEvadeThreshold`.
4. `executeEvade` samples candidate headings (configurable count) and selects the best using a safety score.
5. Vitest: a test that simulates a ship taking a burst of damage and asserts the ship switches to `evade` for a duration and successfully increases its distance from attackers.

Vitest validation guidance
-------------------------
- Create `test/vitest/ai-evade.spec.ts` with tests:
  - Simulate a ship receiving a burst (e.g., 20 damage in 1 second) and assert `ship.aiState.recentDamage` rises and `currentIntent` becomes `evade` in next reevaluation.
  - During `evade` test that the ship's distance to the nearest enemy increases by a configurable margin within a few seconds.

Notes
-----
- Use a small sample count (e.g., 8) for performance. Consider adding an early bailout if the naive "direct away" candidate is already good (to save CPU).
- Predicting incoming bullets is optional but gives better evade behavior; at minimum bias away from bullet velocity vectors with positive approach dot product.