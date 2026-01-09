# [TASK161] - Steering helpers, torpedo homing, point defense targeting

**Status:** In Progress  
**Added:** 2026-01-09  
**Updated:** 2026-01-09  

## Original Request

Do robust helpers for steering, make torpedoes homing by default, and design/introduce projectile-targeting point defense behavior/logic.

## Thought Process

- Steering utilities exist but lack higher-level seek/arrive/pursuit/evade helpers; adding them will standardize usage and edge handling.
- Torpedoes already support homing via config overrides, so enabling homing by default should be a minimal config change plus test coverage.
- Point defense requires selecting hostile projectiles as targets and removing them; no projectile-vs-projectile collision exists today, so PD will actively intercept by removing projectiles when fired upon.

## Implementation Plan

- Extend `src/utils/steering.ts` with seek/arrive/intercept/evade helpers and add unit tests.
- Add default homing config for `torpedo:standard` in `src/config/projectiles.ts`.
- Introduce a PD selection helper (projectile targeting) and update turret targeting to support `priority: 'antiProjectile'` with fallback to ship targeting.
- Update `TurretSpec`/`TurretComponent` types and `createPointDefenseTurret` defaults.
- Add/adjust tests covering PD selection and torpedo homing defaults.

## Progress Tracking

**Overall Status:** In Progress — 80%

### Subtasks

| ID  | Description                                               | Status      | Updated    | Notes |
| --- | --------------------------------------------------------- | ----------- | ---------- | ----- |
| 1.1 | Add steering helpers + unit tests                         | Complete    | 2026-01-09 | New seek/arrive/intercept/evade helpers |
| 1.2 | Enable torpedo homing defaults + tests                    | Complete    | 2026-01-09 | Update projectile config and coverage |
| 1.3 | Implement PD projectile targeting + turret logic          | Complete    | 2026-01-09 | Add selection helper + turret updates |
| 1.4 | Update types + turret factory defaults                    | Complete    | 2026-01-09 | Add antiProjectile priority |
| 1.5 | Add PD-focused turret tests + fallback coverage           | Complete    | 2026-01-09 | Validate selection and fallback |

## Progress Log

### 2026-01-09

- Created design/requirements scaffolding and task tracking.
- Added steering helpers and tests, enabled torpedo homing defaults, and implemented PD targeting logic with unit coverage.
