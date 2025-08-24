# IMPLEMENTATION_STATUS.md

## Completed Goals

- All game balance, progression, visuals, and entity stats are centralized in config TypeScript files.
- Pure TypeScript codebase; all types in index.ts.
- Renderer and simulation logic read all tunables from config—no hardcoded gameplay or visual values remain.
- Config-driven architecture is complete; progression uses function-valued scalars for XP, HP, damage, shield, speed, and regen.
- Visual effects, particles, and UI overlays are parameterized via config.
- Unit and smoke tests for progression and scaling pass; build outputs and runtime verified.
- Config hygiene improved: STARS.background removed (use AssetsConfig.palette.background), arcWidth in SHIELD commented/TODO'd, TODO for unifying particle configs with assetsConfig.ts.
- **2025-08-23: Major type/config tightening:**
  - ShipSpec now requires `accel`, `radius`, and non-empty `cannons`.
  - CannonSpec requires `damage` and supports new optional fields (`angle`, `rate`, `spread`, `muzzleSpeed`, `bulletRadius`, `bulletTTL`, `ttl`, `reload`, `range`).
  - ShipConfigMap requires full ShipSpec objects (no partials).
  - Legacy fields (e.g., `dmg`) maintained for compatibility; fallback logic added.
  - All changes validated with TypeScript and tests.

## Current State

- All major subsystems are config-driven and tested.
- Renderer buffer logic and scaling are robust and consistent.
- Most test failures resolved; only edge cases remain.
- Config files reviewed for duplication/unused entries; hygiene improved.
- **Type/config migration complete; all configs match stricter requirements.**

## Short-term Goals

- Unify overlapping particle effect configs between gamemanagerConfig.ts and assetsConfig.ts.
- Ensure arcWidth in SHIELD is either used or removed.
- Expand edge case test coverage for config-driven logic.
- **Remove legacy fields (e.g., `dmg`) after all callers are updated.**
- **Document new required/optional fields in code comments and PR notes.**

## Long-term Goals

- Document and implement config unification steps.
- Run full Vitest and Playwright suites for regression and browser validation.
- Add more multi-level progression/scaling tests.
- Continue optimizing config hygiene and maintainability.
