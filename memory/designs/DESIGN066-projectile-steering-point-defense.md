# DESIGN066 - Steering Helpers, Torpedo Homing, Point Defense

**Status:** Proposed  
**Created:** 2026-01-09

## Summary

Add robust steering helper functions (seek/arrive/pursuit/evade), enable torpedo homing by default, and introduce point-defense projectile targeting for turrets. The goal is to make guidance behavior more consistent while enabling PD turrets to prioritize and intercept incoming missiles/torpedoes.

## Requirements

- See `memory/requirements.md` — 2026-01-09 section.

## Goals

- Provide steering helpers that are safe for zero-length vectors and predictable under edge conditions.
- Make `torpedo:standard` home by default with conservative turn rate.
- Add a turret targeting mode that prioritizes hostile projectiles within range and falls back to ship targeting when none exist.

## Non-Goals

- Full projectile-vs-projectile collision simulation.
- AI doctrine changes or balance tuning beyond torpedo homing defaults.
- New renderer effects for PD interceptions (can be layered later).

## Architecture Overview

- `src/utils/steering.ts` gains new helper functions for direction selection and intercept math.
- `src/config/projectiles.ts` adds a homing config for `torpedo:standard`.
- `src/game/utils/targetSelection.ts` gains a projectile-target selection helper for PD.
- `src/game/systems/turrets.ts` extends target selection logic to support `priority: 'antiProjectile'`.

## Data Flow

1. Turret update runs → selects target:
   - If `priority === 'antiProjectile'`, scan enemy projectiles in range (prefer those targeting the parent ship).
   - Otherwise use existing ship targeting (priority/nearest).
2. If a projectile target is selected, the turret fires toward its position and the projectile is removed.
3. If no projectile target is found, the turret falls back to ship targeting and fires as before.

## Data Model & Type Changes

- Extend `TurretSpec.priority` and `TurretComponent.priority` to include `'antiProjectile'`.
- No new GameState fields. Use existing `state.queries.projectiles` and `state.shipById`.

## Interfaces (planned)

Steering helpers in `src/utils/steering.ts`:

- `computeSeekDirection(targetPos, sourcePos, out?, fallback?)`
- `computeArriveDirection(targetPos, sourcePos, slowRadius, stopRadius?, out?, fallback?)`
- `computeInterceptDirection(targetPos, sourcePos, targetVelocity, sourceSpeed, out?, fallback?)`
- `computeEvadeDirection(threatPos, sourcePos, threatVelocity, sourceSpeed, out?, fallback?)`

Projectile targeting in `src/game/utils/targetSelection.ts`:

- `findPointDefenseTarget(state, origin, team, options)`
  - Prefer projectiles that are hostile and targeting the parent ship.
  - Filter to missile/torpedo categories (or homing projectiles) by default.

## Error Handling

- Steering helpers clamp/validate inputs and fall back to `FORWARD` for invalid vectors.
- PD targeting ignores invalid or friendly projectiles; no throwing in hot loops.

## Testing & Validation

- Extend `test/vitest/steering-utils.spec.ts` for new steering helpers and edge cases.
- Add turret PD tests (antiProjectile selection + fallback to ships).
- Update/extend projectile tests to ensure torpedo homing defaults are applied.

## Performance Considerations

- PD targeting iterates projectiles only for `antiProjectile` turrets.
- Filtering is early-out (range + team + category checks) to minimize cost.

## Open Questions

- Should PD interception remove projectiles immediately or apply damage over time?
- Should PD prioritize only homing missiles/torpedoes or include proximity-fuse flak rounds?
