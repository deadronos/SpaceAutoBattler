# TASK248 - Weapon Category Expansion

**Status:** In Progress
**Added:** 2025-10-14
**Updated:** 2025-10-14

## Original Request

Plan and implement missiles, torpedoes, and beams per `/spec/extend-weapon-types.md`, with sensible hull configurations (fighters gain a torpedo slot, other hulls gain role-specific loadouts) and ensure point-defense behaviour prioritises incoming missiles. Run tests and linters on completion.

## Thought Process

- The existing projectile pipeline only understands ballistic bullets. Introducing missiles/torpedoes requires both simulation schema changes and renderer support.
- Guided projectiles demand per-frame steering and arming timers; AoE damage needs deterministic loops to avoid double counting.
- Beams should operate as hitscan to avoid Rapier lifetime overhead while still emitting visuals for the renderer.
- Hull configs must expose the new weapon categories without breaking existing stats; turret specs are the best place to express role-based loadouts.
- Point-defense is largely a turret targeting problem: detecting missiles within range and reprioritising them before normal ship targets.

## Implementation Plan

1. **Schema & Config Updates** — Extend projectile/turret types, add beam event type, and expand `PROJECTILE_CONFIG` with missile/torpedo/beam entries.
2. **Ship Loadouts** — Update `shipStats` to assign new turrets (fighter torpedo rack, corvette missiles, capital ship PD beams) and PD metadata.
3. **Simulation Logic** — Update projectile systems for homing, arming, AoE, and beam handling including Rapier raycasts.
4. **AI Point-Defense** — Enhance turret targeting to prioritise missile projectiles when PD range is active.
5. **Rendering** — Register new materials/geometries and implement a beam layer; ensure instanced layer orients elongated projectiles correctly.
6. **Testing** — Add Vitest coverage for spawn metadata, AoE/arming, beams, and PD targeting.
7. **Validation & Cleanup** — Run `npm run lint`, `npm run format`, `npx tsc --noEmit`, and `npm test`; update docs if required.

## Progress Tracking

**Overall Status:** In Progress — 0%

### Subtasks

| ID  | Description                                   | Status        | Updated     | Notes |
| --- | --------------------------------------------- | ------------- | ----------- | ----- |
| 1.1 | Update types and projectile config schema      | Not Started   | 2025-10-14  |       |
| 1.2 | Revise ship loadouts with new weapon roles     | Not Started   | 2025-10-14  |       |
| 1.3 | Implement homing/AoE/beam logic in systems     | Not Started   | 2025-10-14  |       |
| 1.4 | Implement PD targeting behaviour               | Not Started   | 2025-10-14  |       |
| 1.5 | Update renderer materials/geometries           | Not Started   | 2025-10-14  |       |
| 1.6 | Add Vitest coverage for new behaviours         | Not Started   | 2025-10-14  |       |
| 1.7 | Run validation commands and polish             | Not Started   | 2025-10-14  |       |

## Progress Log

### 2025-10-14
- Logged requirements and drafted design document `memory/designs/TASK248-weapon-category-expansion.md` outlining architecture, data flow, and testing strategy.
- Created implementation task plan with subtasks covering schema updates through validation.

