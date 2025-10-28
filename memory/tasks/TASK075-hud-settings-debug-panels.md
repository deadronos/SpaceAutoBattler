# TASK147 - HUD Settings & Debug Panels

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Introduce a gear-driven settings panel and a wrench-driven debug panel within the HUD so presentation toggles (postprocessing, HUD overlays, AI V2) and debug overlays (AI, explosion) move out of the crowded top control bar. Ensure postprocessing and AI V2 default to enabled, design both drawers for future extension, and keep overlays wired to their store flags.

## Thought Process

The top control bar currently exposes numerous toggles, squeezing critical controls (pause, reset, spawn). Moving auxiliary toggles into HUD drawers reduces clutter while providing discoverable controls near the status card. We must align with deterministic UI defaults (postprocessing + AI V2 enabled), create accessible icon buttons, and structure toggle rendering so additional debug toggles can be appended without rewriting layout logic. The drawers should operate independently, living entirely in UI state without mutating simulation data except through existing `useUiStore` mutators.

## Implementation Plan

- [x] Update `useUiStore` defaults: enable `postprocessingEnabled` and `aiV2Enabled` by default; retain setter/toggle APIs and ensure `AI_CONFIG.v2Enabled` overrides remain honoured.
- [x] Author shared toggle configuration (`SETTINGS_TOGGLES`, `DEBUG_TOGGLES`) exporting metadata + handlers mapped to `useUiStore` selectors.
- [x] Implement reusable `HudToggleDrawer` component handling icon trigger, accessibility, keyboard shortcuts, and rendering toggle rows from config.
- [x] Wire `SettingsDrawer` and `DebugDrawer` into `Hud`, position icons within the HUD panel, and remove legacy toggle buttons from `Controls`.
- [x] Extend styles (`app.css`) for the new drawers, buttons, and responsive layout adjustments.
- [x] Add Vitest coverage (`ui-store-defaults`, `ui-settings-panels`, `ui-debug-panels`) validating defaults, drawer behaviour, and toggle dispatch.
- [x] Smoke manual validation: verify postprocessing + AI overlays respond to toggles; capture follow-up tasks if Playwright automation cannot be updated immediately.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                           | Status   | Updated    | Notes                                                                        |
| --- | ----------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------- |
| 1.1 | Adjust `useUiStore` defaults and ensure config parity | Complete | 2025-09-28 | Enabled default postprocessing + AI V2 while preserving env overrides.       |
| 1.2 | Implement toggle configuration registries             | Complete | 2025-09-28 | Added `hudToggleConfig.ts` with deterministic handlers.                      |
| 1.3 | Build `HudToggleDrawer` + Settings/Debug drawers      | Complete | 2025-09-28 | Created reusable drawer with SVG icons and accessibility affordances.        |
| 1.4 | Update controls/HUD layout and styling                | Complete | 2025-09-28 | Removed legacy toggles from controls; styled HUD drawers.                    |
| 1.5 | Add Vitest coverage for defaults and drawers          | Complete | 2025-09-28 | Authored `ui-store-defaults`, `ui-settings-panels`, `ui-debug-panels` specs. |
| 1.6 | Perform validation (typecheck/tests/manual smoke)     | Complete | 2025-09-28 | Ran `npm run typecheck` + `npm test`; manual HUD toggle smoke OK.            |

## Progress Log

### 2025-09-28

- Captured requirements and design for HUD settings/debug drawers; implementation pending.
- Implemented HUD drawers, shared toggle config, and styling updates; validated defaults and interactions with new Vitest suites plus `npm run typecheck`/`npm test`.
