# Design — HUD Health Overlays

**Summary:** Introduce per-ship HUD overlays that visualise shields, hull integrity, and status effects using stacked micro health bars, with a user-toggleable control in the top controls bar. The system must respect deterministic state updates, accessibility requirements, and avoid occluding existing UI panels.

## Research Highlights

- Persistent feedback reduces player uncertainty; health bars act as progress indicators communicating system status every frame.[^nng]
- Provide configurable HUD elements so players can adjust or disable overlays when obstructive, aligning with game accessibility guidance on rearrangeable interfaces.[^gag]
- Color usage must meet WCAG 2.1 AA contrast ratios to remain legible under varied backgrounds and color-vision differences.[^wcag]

[^nng]: Katie Sherwin, "Progress Indicators Make a Slow System Less Insufferable," Nielsen Norman Group, Oct 26, 2014 — <https://www.nngroup.com/articles/progress-indicators/>

[^gag]: Game Accessibility Guidelines — <https://gameaccessibilityguidelines.com/full-list/>

[^wcag]: W3C, "Understanding Success Criterion 1.4.3 Contrast (Minimum)," — <https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html>

## Goals

- Visualise shield and health values for every visible ship without breaking deterministic playback.
- Surface temporary status effects (jammed, shield-down, engine disruption, etc.) in a compact, glanceable format.
- Provide HUD toggle(s) and layout fallbacks that prevent overlays from colliding with existing radar or scoreboard elements.
- Maintain accessibility with readable typography, color contrast, and motion limits that minimise distraction.

## Non-Goals

- Redesigning the existing team HUD summary cards.
- Implementing new status effect gameplay systems (assume effects are exposed via `ShipEntity`).
- Adding audio cues or vibration for health changes (visual only).

## Architecture Overview

- Extend `useUiStore` with `hudHealthBarsEnabled` boolean, setter, and toggle actions. Persist default in optional future session storage.
- Add `HudHealthLayer` component co-located with `Hud.tsx`; subscribes to `useUiStore` and `useArchetypeEntities` to render overlay instances.
- Introduce `ShipHudOverlay` presentational component responsible for drawing stacked bars, labels, and status icons. Receives pure props mapped from `ShipEntity`.
- Implement `StatusEffectBadge` subcomponent that resolves icon + tooltip metadata from a centralized registry for deterministic mapping.
- Register the toggle button in `Controls.tsx` (top controls bar) with ARIA label, keyboard support, and tooltip.
- Reuse seeded RNG utilities for animation easing to ensure deterministic bar interpolation during replays or synced simulations.
- Add layout manager within `HudHealthLayer` to prevent occlusion: compute screen-space positions, offset overlays near edges, and hide when overlapping critical UI bounding boxes.

## Data Flow

1. `Controls` exposes `Hud Health Bars` toggle wired to `useUiStore((s) => s.toggleHudHealthBars)`. Defaults to enabled in desktop builds.
2. `Hud` renders `<HudHealthLayer />` alongside existing panels. The layer uses `useOptionalGameState` and `useArchetypeEntities` to obtain the current ship list (sorted by render order to minimise z-fighting).
3. For each ship, `HudHealthLayer` projects world position to screen-space via Three renderer/camera utilities (existing `Ship` component exposes transforms). Data object includes ship id, team, shield/health ratios, hull class, and effect flags.
4. `ShipHudOverlay` receives the projection plus UI store configuration (bar sizes, colors) and renders contained bars:
   - `ShieldBar` width := `ship.shield / ship.maxShield` (clamped 0..1).
   - `HealthBar` width := `ship.hp / ship.maxHp`.
   - Animated transitions use deterministic `lerpBySeed(seed, previousWidth, targetWidth, dt)` helper.
5. Status effect array originates from `ship.effects` (new optional field) or derived heuristics (e.g., `ship.shield <= 0` -> shield-down badge). Each effect maps to icon asset + tooltip string.
6. Occlusion service checks overlay bounding boxes against reserved UI regions (controls bar, HUD panel). Collisions trigger reposition offsets or mark overlay as minimized (text-only fallback in scoreboard ledger).

## Interfaces

```ts
export interface HudHealthOverlayConfig {
  shieldColor: string; // default '#4cc2ff'
  healthColor: string; // default '#3bd675'
  barWidth: number; // px, default 80
  barHeight: number; // px, default 6
  gap: number; // px spacing between bars
  animationDurationMs: number; // default 150
}

export interface ShipHudState {
  id: number;
  team: Team;
  hull: ShipHull;
  worldPosition: Vector3;
  screenPosition: { x: number; y: number; visible: boolean };
  healthRatio: number; // 0..1
  shieldRatio: number; // 0..1, NaN when no shields
  statusEffects: StatusEffectTag[]; // e.g., ['jammed', 'shield-down']
  seed: number; // stable RNG seed per ship for animations
}

export type StatusEffectTag = 'jammed' | 'shield-down' | 'engine-disrupted' | 'hacked';

export interface HudHealthBarsStoreSlice {
  hudHealthBarsEnabled: boolean;
  toggleHudHealthBars: () => void;
  setHudHealthBarsEnabled: (v: boolean) => void;
}
```

## Visual & Accessibility Specification

- Bars stack vertically: shield (top) tinted blue, hull (bottom) tinted green; apply 12px status badge gutter to the right.
- Use 1px inner background stroke with contrast-friendly neutral (#1f2933 with 60% alpha) to preserve readability over bright backgrounds.
- Cap animation at 150ms and avoid overshoot to minimise motion sickness; degrade to instantaneous updates if user enables "reduced motion" preference (respect `prefers-reduced-motion`).
- Tooltip text appears on hover/focus, includes keyboard-accessible trigger (e.g., aria-describedby) to satisfy screen reader access.
- Provide optional text fallback in scoreboard (`Hud` panel) summarising average hull integrity when overlays disabled.

## Error Handling Matrix

| Scenario                                                  | Detection                                                 | Response                                                                                              | Test Coverage                                         |
| --------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Ship lacks `maxHp`/`maxShield` or values ≤ 0              | Ratio calculation yields NaN/∞                            | Clamp to 0, log once via debug channel, render empty bar                                              | Unit test stubs invalid data and asserts safe default |
| Status effect tag missing from registry                   | Lookup returns undefined                                  | Render generic warning icon with tooltip "Unknown effect"                                             | Unit test feeds unknown tag and expects fallback      |
| Projection fails (ship off-screen / camera missing)       | `screenPosition.visible === false`                        | Hide overlay but keep scoreboard text fallback                                                        | Playwright spec hovers camera edge case               |
| Overlay bounding box collides with HUD panels             | Collision detector returns `true`                         | Apply vertical offset; if still colliding, suppress overlay                                           | Integration test positions ship near UI edges         |
| Toggle state desynchronised with authoritative game state | UI store toggles while `GameState` flagged paused/resumed | Mirror toggle value into `GameState.uiFlags.hudHealthBars` on next frame to keep deterministic record | State-sync unit test mocks store update               |

## Testing Strategy

- **Unit (Vitest):**
  - `hud-overlay-layout.spec.ts`: validate ratio calculations, stacked bar rendering, color tokens, and occlusion offsets.
  - `hud-overlay-animation.spec.ts`: assert deterministic easing using seeded RNG and respect for reduced-motion preference.
  - `hud-status-icons.spec.ts`: confirm effect mapping, contrast checks (4.5:1 threshold), tooltip text, and unknown-effect fallback.
  - `ui-store-hud-toggle.spec.ts`: ensure toggle mutates store slice and syncs with `GameState` mirror flags.
- **Integration (Playwright):**
  - `hud-healthbars.spec.ts`: toggle overlays on/off, verify per-ship bars render for both teams, and confirm scoreboard fallback when disabled.
  - `hud-overlay-occlusion.spec.ts`: position camera near controls bar and assert overlays reposition or hide gracefully.
- **Manual Validation:**
  - Check overlays against starfield/light backgrounds for contrast compliance.
  - Confirm readability on 1080p and 4K resolutions with UI scaling.

## Implementation Notes

1. Extend `useUiStore` slice and persist to `localStorage` (optional follow-up) to remember user preference.
2. Refactor `Hud` to host `HudHealthLayer` and pass camera/renderer references via context or props.
3. Implement projection utility reused by both overlays and future HUD widgets; wrap existing Three.js camera conversions.
4. Define `statusEffectRegistry` enumerating icon paths, tooltip keys, and severity for layout priority.
5. Add CSS module or styled component for overlay styling with minimal DOM overhead (<4 divs per ship) to avoid layout thrash.
6. Provide translation keys for tooltip strings in existing i18n system (if absent, stage placeholder).

## Decisions & Scope

- The HUD health-bar toggle defaults to `off` on first launch and on low-power profiles; the preference persists once the user enables it.
- Render at most two concurrent status icons per ship. Additional effects collapse into a consolidated `+N` badge with tooltip details.
- Advanced per-player color customization remains out of scope for the initial release; revisit after baseline accessibility validation.

## Implementation Outcome (2025-03-29)

- **UI Store & Game State:** Added `hudHealthBarsEnabled` slice with toggle/setters in `src/game/uiStore.ts` and mirrored deterministic flagging through `src/game/context.tsx` and `src/game/state.ts`, keeping replays authoritative.
- **Renderer Pipeline:** Introduced `HudOverlayCollector` to gather ship projections and feed a centralized `hudOverlayStore` (`src/renderer/hudOverlayStore.ts`). Layout and occlusion handling land in `HudHealthLayer`, while `ShipHudOverlay` renders stacked bars, tooltips, and deterministic easing (`src/utils/deterministicLerp.ts`).
- **Configuration & Accessibility:** Codified overlay config and status effect registry in `src/config/hudHealth.ts`, ensuring WCAG-aligned colours, badge capping, and fallback text in `Hud.tsx` when overlays are disabled.
- **Controls & Styling:** `src/components/Controls.tsx` hosts the toggle with ARIA labelling and reduced-motion support via `src/hooks/usePrefersReducedMotion.ts`; visual styling resides in `src/styles/app.css`.
- **Testing:** Vitest coverage spans layout, occlusion, animation smoothing, status effect fallbacks, and UI store mirroring (`test/vitest/hud-overlay-layout.spec.ts`, `hud-overlay-animation.spec.ts`, `hud-status-icons.spec.ts`, `ui-store-hud-toggle.spec.ts`, plus shared setup).
- **Task Tracking:** Documented completion in `memory/tasks/TASK141-hud-health-overlays.md` and updated `memory/tasks/_index.md` to reflect the delivered overlay system.
