# [TASK240] - Add `rings.bloomOnly` config flag

**Status:** In Progress  
**Added:** 2025-10-03  
**Updated:** 2025-10-03

## Original Request

Add an optional `bloomOnly` boolean to the planetary `rings` configuration so artists can opt rings into a bloom-only rendering path (i.e., visually represented primarily via postprocessing bloom) without breaking baseline visibility when postprocessing is disabled.

## Requirements (EARS)

- WHEN a planet has `rings.bloomOnly` set to `true`, THE RENDERER SHALL allow the bloom manager to route the ring material into selective bloom without forcing the material to remain color-write-enabled. [Acceptance: Unit test verifies BloomProvider allows bloom-only materials to have colorWrite toggled and ring geometry renders only to bloom layer when `bloomOnly=true`].
- WHEN a planet does not set `rings.bloomOnly` or sets it to `false`, THE RENDERER SHALL ensure the ring remains visible even when postprocessing is disabled. [Acceptance: Visual/manual check + unit regression where PP disabled still yields visible ring object].
- WHEN `bloomOnly` is used, THE SYSTEM SHALL document the behavior and provide an opt-in default (false). [Acceptance: Memory bank task and `_index.md` updated; config default visible in `CELESTIAL_ENVIRONMENT`].

## Design

- Configuration:
  - Add `bloomOnly?: boolean` to `PlanetBodyConfig.rings` in `src/config/environment.ts`.
  - Default value: `false` in presets so existing scenes keep baseline visibility.
- Renderer wiring (follow-up):
  - `PlanetRings` will read `bloomOnly` and, if true, avoid tagging the ring material with the `__copilot_forceColorWrite` flag that prevents the bloom provider from setting `material.colorWrite = false`.
  - `BloomProvider` will respect `material.userData.__copilot_forceColorWrite` when deciding whether to toggle `colorWrite`; if absent, `bloomOnly` elements will be allowed to be routed to bloom-only.
- Testing:
  - Add Vitest coverage that simulates registering a mesh with `bloomOnly` and asserts `BloomProvider` applies selective bloom routing behavior appropriately (colorWrite toggled when `bloomOnly=true`, preserved when `false`).

## Implementation Plan

- [x] Add `bloomOnly?: boolean` to `PlanetBodyConfig.rings` and set `bloomOnly: false` for the `gasGiantPrime` preset.
- [ ] Implement wiring in `PlanetRings` (use `bloomOnly` to conditionally set `userData.__copilot_forceColorWrite`).
- [ ] Update `BloomProvider` and add unit tests verifying behavior for both `bloomOnly` true/false.
- [ ] Create a visual regression test ensuring ring visibility with PP disabled.
- [ ] Document changes in PR summary and update relevant README/architecture notes.

## Progress Log

### 2025-10-03

- Added `bloomOnly` to `PlanetBodyConfig.rings` and set conservative default `false` for `gasGiantPrime`.
- Implemented initial wiring for `bloomOnly` into `PlanetRings` and `BloomProvider` (follow-up tests planned).
- Implemented procedural banding and planet-shadow tests in the ring shader with configurable banding controls.
- Added soft penumbra and a dev debug panel to tune `shadowStrength` and `penumbra` interactively.
- Tuned `gasGiantPrime` ring defaults to better match the photographic reference (denser bands, stronger band contrast, darker grooves, stronger shadow and modest penumbra):
  - color: `#9e9e9e`
  - opacity: `0.85`
  - brightness: `0.95`
  - fresnelStrength: `1.8`
  - tintColor: `#bfbfbf`, tintMix: `0.12`
  - bandFrequency: `380.0`
  - bandStrength: `0.9`
  - bandNoiseScale: `0.45`
  - bandDarkness: `0.78`
  - shadowStrength: `0.95`
  - penumbra: `0.06`

These changes are in `src/config/environment.ts`. Follow-up: create a small Playwright visual regression capture to compare the tuned defaults with the photographic reference and iterate if necessary.

## Acceptance Criteria

- `bloomOnly` appears in the schema and presets.
- Memory bank includes TASK240 and `_index.md` references.
- Follow-up implementation tasks created for wiring and tests.

