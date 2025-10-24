# TASK142 - Implement ship kill explosion FX

**Status:** Completed
**Added:** 2025-09-27
**Updated:** 2025-09-27

## Original Request

Implement the guidance outlined in `memory/designs_completed/design-explosionfx.md`, adding deterministic multi-stage ship kill explosion effects and integrating them across simulation and renderer layers.

## Thought Process

- Explosion events must originate in the simulation so renderer playback stays deterministic and seedable.
- We need a pooled data structure on `GameState` to store active explosion events alongside helper utilities for allocation and recycling.
- Config should live under `src/config` with faction/hull presets that renderer and simulation share.
- Renderer responsibilities split between geometry/material animation and transient light management, both keyed off the seeded event timeline.
- Tests should cover event emission and lifecycle progression to lock down determinism.

## Implementation Plan

- [x] Extend `GameState` types and factory to include explosion pools plus helper utilities.
- [x] Create `src/game/explosions.ts` with `emitShipKillExplosion` and `updateExplosions`, wiring it into projectile resolution.
- [x] Add `EXPLOSION_CONFIG` under `src/config/explosions.ts` with faction/hull presets and expose typed interfaces.
- [x] Build React renderer components (`ExplosionRenderer`, `ExplosionsLayer`, `DynamicLightManager`) consuming the new events with pooled instancing and bloom integration.
- [x] Update the battlefield composition to include explosions and ensure bloom/light hooks run only when events exist.
- [x] Implement Vitest specs for event emission, lifecycle updates, renderer parameter curves, and light manager behaviour.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                           | Status   | Updated    | Notes                                                    |
| --- | ----------------------------------------------------- | -------- | ---------- | -------------------------------------------------------- |
| 1.1 | Extend GameState explosion storage and helpers        | Complete | 2025-09-27 | GameState now tracks explosion pool and ids              |
| 1.2 | Simulation hooks for emitting/updating explosions     | Complete | 2025-09-27 | Emission + lifecycle wired into projectile resolution    |
| 1.3 | Renderer components for explosion stages and lighting | Complete | 2025-09-27 | Instanced ExplosionRenderer + lights integrated          |
| 1.4 | Configuration presets and palette mappings            | Complete | 2025-09-27 | Added faction/hull presets in config module              |
| 1.5 | Test coverage for explosions                          | Complete | 2025-09-27 | Added Vitest suites and projectile integration assertion |

## Progress Log

### 2025-09-27

- Captured initial understanding of explosion FX requirements and drafted implementation plan aligned with design memo.
- Created task entry and baseline subtasks for tracking.
- Implemented explosion event pooling, simulation integration, renderer stages, and dynamic light manager.
- Added explosion configuration, updated battlefield layering, and introduced Vitest coverage for emission, lifecycle, and projectile integration.
