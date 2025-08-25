Summary of changes: Weapon range gating and normalization

What was changed

1. Runtime normalization of weapon ranges

- File: src/config/entitiesConfig.ts
- Implemented normalization in getShipConfig() so configs may omit explicit `range`.
  - For each cannon without `range`, the code computes: range = Math.round(muzzleSpeed \* bulletTTL).
    - Falls back to `BULLET_DEFAULTS.range` when muzzleSpeed or bulletTTL is missing or not finite.
  - For each turret without `range`, the code assigns the first cannon's range from the same ship type if available, otherwise `BULLET_DEFAULTS.range`.
- Rationale: avoids manual population of every turret/cannon with range values and ensures runtime consistency.

2. AI firing respects weapon range

- File: src/behavior.ts
- The AI now checks weapon ranges before spawning bullets:
  - For legacy cannons: the distance from the ship center to the chosen target is checked against `c.range` (or `BULLET_DEFAULTS.range`). If out of range, the cannon does not fire and cooldown is not consumed.
  - For turrets: the firing origin is computed from turret mountpoint and ship transform; the distance from that origin to the turret target is checked against `turret.range` (or `BULLET_DEFAULTS.range`). If out of range, the turret does not fire and cooldown is not consumed.
- Helper: a squared-distance helper (`withinRange`) was used to avoid sqrt for performance.
- Rationale: prevents ships/turrets from firing at targets outside effective weapon range; enables more realistic AI behaviour and reduces unnecessary bullet spawning.

3. Tests added

- File: test/vitest/ai-range.spec.ts
- Added two deterministic tests:
  - Verifies no bullets are spawned when target is far outside cannon range.
  - Verifies bullets are spawned when target is within cannon range.
- Tests forcibly set ship AI state to `engage` to avoid randomness in decision-making.

Notes and considerations

- Turret range inheritance: turrets without explicit `range` inherit the ship's first cannon range. This was chosen as a conservative default; if turrets later get independent muzzleSpeed/TTL, the normalization should be updated to compute turret ranges from turret-specific values.
- Cooldown behavior: cooldown is only set when a shot is actually spawned. AI will not consume cooldown while waiting for a target to enter range.
- Performance: range checks use squared distances to avoid Math.sqrt overhead.

How it was verified

- Ran type-check and full Vitest suite locally (command: `npx vitest -c vitest.config.js --run`). All tests passed after changes.

Files modified/added

- Modified: src/config/entitiesConfig.ts (added runtime normalization logic)
- Modified: src/behavior.ts (ensured range checks are applied before firing)
- Added: test/vitest/ai-range.spec.ts (tests for range gating)
- Added: docs/weapon-range-change.md (this file)

Recommended follow-ups

- Optionally populate explicit `range` values for turrets where fine-tuning is required.
- If turret-specific muzzleSpeed/TTL are introduced, update normalization to compute turret ranges from those values.
- Consider adding logging or debug flags to trace skipped fires due to range during tuning.

Owner: opencode
Date: 2025-08-26
