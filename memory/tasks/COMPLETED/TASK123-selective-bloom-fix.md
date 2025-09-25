# [TASK123] - Selective Bloom Contrast Fix

**Status:** Completed
**Added:** 2025-09-24
**Updated:** 2025-09-24

## Original Request

Investigate why postprocessing bloom brightens the entire scene even with a high threshold. Provide a targeted fix so bloom only affects intended emissive elements (engines, trails, projectiles, shields, star disk). Support explicit component opt-in/out and expose relevant configuration.

## Thought Process

The existing implementation passes a plain `Set` into `SelectiveBloomEffect`, which expects a `Selection` helper. As a result, the effect falls back to a full-scene luminance pass, causing global brightening regardless of the threshold. We need a registry that tracks bloom groups, exposes configuration, and ensures only registered objects contribute to bloom.

## Implementation Plan

- [x] Replace the ad-hoc `Set` with `Selection` instances keyed by bloom groups.
- [x] Extend `BloomProvider` context with registration options (group, activation) and maintain stable selections.
- [x] Update `Postprocessing` pipeline to instantiate one selective bloom effect per configured group, apply thresholds/intensities, and ignore background.
- [x] Add renderer config for bloom groups and update components (ships, shields, projectiles, etc.) to register with appropriate groups.
- [x] Validate visually and via code review that postprocessing off/on preserves dark space background while highlighting emissive assets.

## Progress Log

### 2025-02-14
- Created task entry and outlined plan for selective bloom fix.
- Replaced raw Set usage with `Selection` maps per bloom group and added configurable registration options.
- Added per-group postprocessing configuration and wired ships, shields, projectiles, explosions, and muzzle flashes into explicit bloom groups.
- Verified selective bloom initialization and noted vitest diagnostic harness requires tmp log directory (existing known warning).
