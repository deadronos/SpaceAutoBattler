# TASK108 — Debug UI simulation settings updates

**Status:** Completed  
**Added:** 2025-11-16  
**Updated:** 2025-11-16

## Original Request
Expose the configurable simulation profiling/guard options from DESIGN056 in the debug UI and refresh the debug modal layout so the growing list of toggles feels manageable (two-column layout suggested).

## Thought Process
- The new subsystem profiling flags (`profileSubsystems`, `profileSampleRate`, `enableSubsystemGuards`) now exist on the simulation clock but are not surface in the UI.
- The debug drawer is the natural place for experiment flags, but it already contains many toggles and could benefit from a multi-column layout plus grouped controls (e.g., a sample-rate selector).
- The UI should mirror state changes directly to `state.simulation` so toggling debug controls has immediate effect, and the layout needs to be flexible for future debug options.

## Implementation Plan
- Add `simProfileSubsystems`, `simProfileSampleRate`, and `simEnableSubsystemGuards` state to `useUiStore` with toggles/setters, and mirror those values into `state.simulation` inside `GameProvider`.
- Expand the debug drawer toggles to include the new profiling and guard switches, and add an inline sample-rate control (button group) linked to the `setSimProfileSampleRate` action.
- Update `HudToggleDrawer` styling to render toggles in two columns via CSS grid and add new classes for the sample-rate control block so the expanded debug UI stays compact.
- Update the Memory Bank task status/progress logs to capture the work.

## Progress Tracking
**Overall Status:** Completed - 100%

### Subtasks
| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Document the new requirement and link to DESIGN056, ensuring the memory bank reflects this work. | Complete | 2025-11-16 | This task file documents the goal (new debug settings). |
| 1.2 | Wire UI store state + context mirroring to expose the simulation flags at runtime. | Completed | 2025-11-16 | Added store fields/effects hooking to mirroring. |
| 1.3 | Rebuild the debug drawer layout, add new controls, and adjust CSS to support two columns. | Completed | 2025-11-16 | Added new sample-rate block, grid layout, and CSS adjustments. |

## Progress Log
### 2025-11-16
- Added this task after the user requested the debug UI changes for simulation profiling/guards; plan to mirror the settings via the UI store and refresh the debug drawer layout (including a suggested two-column grid).
- Added store fields and mirroring effects that keep `state.simulation.*` in sync whenever the new debug toggles change.
- Extended the debug drawer with subsystem profiling/guard toggles plus a sample-rate selector, switched the list to a two-column grid, and refreshed the CSS to keep the panel compact.
- Ran `npm test -- test/vitest/update-game-profiling.spec.ts` to ensure the profiling guards still behave as expected while the UI store was expanded.
- Added a “Simulation Diagnostics & Debug Controls” section to `docs/performance-best-practices.md` describing the new toggles and sample-rate guidance for future performance investigations.
