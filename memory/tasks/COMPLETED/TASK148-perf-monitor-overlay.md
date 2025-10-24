# TASK148 - Perf Monitor Overlay

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Wire the [`r3f-perf`](https://github.com/utsuboco/r3f-perf) panel into the battlefield, expose it behind the HUD debug (wrench) menu as a toggle titled "Perf Monitor", and make the resulting window draggable.

## Thought Process

- The existing HUD debug drawer already manages toggle definitions via `DEBUG_TOGGLES`; extending this registry keeps UI wiring consistent.
- Zustand-powered `useUiStore` is the canonical location for UI-only flags, so a new slice can persist enablement and the drag position without touching the deterministic `GameState`.
- Rendering the `r3f-perf` `<Perf />` component requires Canvas context but otherwise stays isolated; a thin wrapper component inside `Battlefield` avoids scattering perf logic across unrelated modules.
- Dragging can be achieved by attaching pointer listeners directly to the perf panel DOM node (exposed via a custom class) and clamping positions to the viewport to avoid losing the window off-screen.

## Implementation Plan

1. Extend `src/game/uiStore.ts` with `perfMonitorEnabled`, `togglePerfMonitor`, `setPerfMonitorEnabled`, `perfMonitorPosition`, and `setPerfMonitorPosition` defaults (disabled, `{ x: 16, y: 16 }`).
2. Register a new `DEBUG_TOGGLES` entry labelled "Perf Monitor" that reflects the store state and calls the toggle action.
3. Create `src/components/PerfMonitorOverlay.tsx` to:
   - Read enablement/position from the store.
   - Render `<Perf />` with inline styles derived from the stored coordinates and a custom `className`.
   - Attach pointer event handlers for drag-to-move, updating the stored position with viewport clamping and cleaning up listeners on unmount.
4. Mount `<PerfMonitorOverlay />` inside `src/components/Battlefield.tsx` so it exists exactly once per canvas render path.
5. Update Vitest suites:
   - Extend `test/vitest/ui-debug-panels.spec.tsx` (and related defaults) to include the new store slice and assert toggle behaviour.
   - Add `test/vitest/perf-monitor.spec.tsx` covering panel mounting, teardown, and drag persistence via simulated pointer events within a minimal canvas.
6. Run `npm run typecheck` and `npm test` to confirm the integration passes existing gates.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                           | Status    | Updated    | Notes                                                                     |
| --- | ----------------------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------- |
| 1.1 | Extend UI store with perf monitor slice               | Completed | 2025-09-28 | Added enablement toggle and persisted drag position.                      |
| 1.2 | Wire toggle into debug drawer registry                | Completed | 2025-09-28 | HUD wrench menu exposes "Perf Monitor" toggle.                            |
| 1.3 | Implement `PerfMonitorOverlay` and battlefield hook   | Completed | 2025-09-28 | Overlay mounts once per canvas and supports dragging with clamped bounds. |
| 1.4 | Author/update Vitest coverage for toggle + overlay    | Completed | 2025-09-28 | Added dedicated spec and updated existing UI toggle suites.               |
| 1.5 | Execute validations (`npm run typecheck`, `npm test`) | Completed | 2025-09-28 | Typecheck clean, full Vitest suite passing.                               |

## Progress Log

### 2025-09-28

- Captured requirements in `memory/requirements.md` and drafted technical design (`memory/designs_completed/design-perf-monitor-overlay.md`) prior to implementation.
- Extended `useUiStore` slice, registered the HUD toggle, created `PerfMonitorOverlay`, and mounted it inside `Battlefield`.
- Authored `test/vitest/perf-monitor.spec.tsx`, refreshed existing HUD toggle specs, and mocked `r3f-perf` for deterministic assertions.
- Ran `npm run typecheck` and `npm test` with all suites passing.
