# Design — Perf Monitor Overlay

**Summary:** Integrate the `r3f-perf` performance panel into the battlefield canvas, expose a "Perf Monitor" toggle under the HUD debug drawer, and let users drag the overlay while persisting its position during the session.

## Goals

- Provide an at-a-glance GPU/CPU/frame metric overlay built on `r3f-perf` without disrupting the existing render pipeline.
- Allow players (and QA) to enable/disable the monitor from the existing debug drawer (wrench icon) with full keyboard/ARIA support.
- Let users reposition the panel via drag-and-drop, persisting the latest coordinates inside the UI store so reopening restores the last placement.
- Keep the implementation canvas-aware, deterministic, and isolated so it can be disabled in production builds if needed.

## Non-Goals

- Persist perf panel preferences beyond the current browser session (future enhancement may add localStorage persistence).
- Replace `r3f-perf` UI with a bespoke panel; we leverage its default visuals.
- Add advanced metrics (custom data feeds, GPU timers) beyond what `r3f-perf` exposes out of the box.

## Architecture Overview

- Extend `useUiStore` with a new `perfMonitorEnabled` boolean, `togglePerfMonitor`, `setPerfMonitorEnabled`, and `setPerfMonitorPosition` actions plus a `perfMonitorPosition` `{ x: number; y: number }` state slice.
- Register the toggle in `DEBUG_TOGGLES` (hud toggle registry) so the wrench drawer surfaces a "Perf Monitor" switch with description text.
- Introduce a `PerfMonitorOverlay` component rendered inside `Battlefield`'s `<Canvas>` that:
  - Watches the store for enablement + position.
  - Mounts `<Perf />` from `r3f-perf` when enabled.
  - Applies inline `style` overrides to reposition the panel and sets a custom class for DOM discovery.
  - Hooks pointer events on the rendered DOM node to implement dragging and update the stored position (clamped to viewport bounds).
- Reuse the store position when re-mounting so the overlay appears where the user left it.
- Keep pointer event listeners confined to the component lifecycle and clean up on disable/unmount.

## Data Flow

1. User opens the debug drawer and toggles the "Perf Monitor" switch.
2. `HudToggleDrawer` invokes `togglePerfMonitor`, flipping `perfMonitorEnabled` in the UI store.
3. `Battlefield` rerenders; `PerfMonitorOverlay` sees `enabled === true` and mounts `Perf` with inline styles derived from `perfMonitorPosition`.
4. `Perf` renders via `HtmlMinimal` into the canvas' container; `PerfMonitorOverlay` attaches pointer event listeners to the panel's DOM node (identified via `className`).
5. While the user drags the panel, the component computes new coordinates (`clientX/Y` minus initial drag offsets), clamps them to `window.innerWidth/Height` minus panel size, and writes the result to `perfMonitorPosition`.
6. On pointer release or toggle disable, listeners detach. The stored coordinates remain in the UI store for the next mount.

## Interfaces

```ts
export interface PerfMonitorPosition {
  x: number; // px from viewport left
  y: number; // px from viewport top
}

export interface UiStorePerfMonitorSlice {
  perfMonitorEnabled: boolean;
  togglePerfMonitor: () => void;
  setPerfMonitorEnabled: (value: boolean) => void;
  perfMonitorPosition: PerfMonitorPosition;
  setPerfMonitorPosition: (position: PerfMonitorPosition) => void;
}
```

`PerfMonitorOverlay` signature:

```ts
export function PerfMonitorOverlay(): React.ReactElement | null;
```

- Renders `null` when disabled.
- Emits `<Perf />` when enabled with inline styles `{ top, left, right: 'auto', bottom: 'auto', position: 'fixed' }` and class `hud-perf-monitor`.
- Attaches pointer listeners (`pointerdown`, `pointermove`, `pointerup`) for drag operations.

## Error Handling Matrix

| Scenario                                                   | Detection                                     | Response                                                                                                              | Notes                                                                         |
| ---------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Canvas not yet initialised (no `gl.domElement.parentNode`) | `Perf` fails to mount or DOM node missing     | `PerfMonitorOverlay` guards on DOM lookup; if the node is absent, it retries on the next effect tick without throwing | Drag activator effect listens to store changes and aborts when node undefined |
| Pointer events unsupported (legacy browsers / tests)       | `window.PointerEvent` undefined               | Skip drag wiring; log debug warning (console.debug) and leave panel anchored at default position                      | JSDOM supports pointer events, but guard remains                              |
| Panel dragged beyond viewport bounds                       | Computed `nextX/nextY` exceed allowable range | Clamp coordinates between `0` and `(viewport - panelSize - margin)` before storing                                    | Prevents lost panel                                                           |
| Toggle flips off during active drag                        | `enabled` becomes false mid-drag              | Effect cleanup removes listeners and resets local dragging state                                                      | Ensures no dangling window listeners                                          |
| Multiple perf panels accidentally mounted                  | Additional DOM node discovered                | Drag hook only binds to the first `.hud-perf-monitor` element; store prevents duplicate toggles                       | Toggle is unique; future guard ensures only one instance                      |

## Testing Strategy

- **Unit / Component (Vitest):**
  - `ui-debug-panels.spec.tsx`: extend coverage to assert the new toggle mutates `perfMonitorEnabled`.
  - New `perf-monitor.spec.tsx`: render a minimal `<Canvas>` + `PerfMonitorOverlay`, enable/disable toggle, assert DOM presence, simulate pointer drag to confirm position updates and persistence.
- **Manual:**
  - Launch dev build, enable perf monitor, drag to each quadrant, ensure toggle correctly hides/shows panel.
  - Verify overlay does not interfere with other HUD elements or pointer interactions.

## Implementation Plan

1. **UI Store:** Add `perfMonitorEnabled`, `perfMonitorPosition`, and associated setters/toggle in `src/game/uiStore.ts`; default position `(16, 16)` and disabled flag.
2. **Toggle Registry:** Update `DEBUG_TOGGLES` in `src/components/hudToggleConfig.ts` with the new definition (label "Perf Monitor", description summarising metrics, select/toggle functions).
3. **Component:** Create `src/components/PerfMonitorOverlay.tsx` encapsulating the logic described above; import and render it from `Battlefield` after the post-processing branch so it always mounts once per canvas.
4. **Styling/Drag:** Implement hook inside the component to attach pointer events, clamp positions, and update the store. Apply inline cursor styling (`grab`/`grabbing`).
5. **Tests:**
   - Update `test/vitest/ui-debug-panels.spec.tsx` (and any setup snapshots) to include the new store slices in reset snapshots.
   - Author `test/vitest/perf-monitor.spec.tsx` verifying enable/disable, DOM presence, drag persistence, and state resets.
6. **Docs/Memory:** Record requirements (done) and maintain this design document; create task entry under `memory/tasks/` with implementation plan and status tracking.

## Open Questions / Future Enhancements

- Persist position + enablement to localStorage so QA retains preferences between reloads.
- Add a smaller "mini" layout option that hides the graph when space is tight.
- Expose `setCustomData` hooks for simulation metrics (ships alive, active projectiles) once baseline integration proves stable.
