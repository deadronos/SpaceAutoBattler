```markdown
# Design — HUD Settings & Debug Panels

**Date:** 2025-09-28  
**Owner:** Copilot agent (per repository workflow)

## Overview

Expose compact HUD-level controls for simulation presentation (postprocessing, HUD overlays, AI V2) and diagnostics (AI debug, explosion debug) without overloading the top control bar. The feature introduces two iconified drawers on the HUD card: a gear-driven **Settings Drawer** and a wrench-driven **Debug Drawer**. Both drawers present toggle lists backed by the existing `useUiStore` flags and share a configuration-driven rendering layer so future toggles can be registered declaratively.

## Requirements Traceability

- R1 → Requirement #1 (gear button toggles drawer visibility)
- R2 → Requirement #2 (settings drawer mutates store flags)
- R3 → Requirement #3 (UI store defaults for postprocessing/AI V2)
- R4 → Requirement #4 (wrench button toggles modular debug drawer)

## Architecture

- Extend `useUiStore` with default updates (`postprocessingEnabled = true`, `aiV2Enabled = true`) and helper setters for drawer state, if needed.
- Introduce `HudToggleDrawer` component that renders an icon button and a floating panel listing toggle rows defined via configuration objects.
- Instantiate two drawers inside `Hud` (`SettingsDrawer`, `DebugDrawer`) passing curated toggle configs.
- Refactor `Controls` component to remove migrated toggles; gear/wrench buttons replace their functionality within the HUD.
- Keep overlays (`AiDebugOverlay`, `ExplosionDebugOverlay`) subscribed to store flags; no changes needed beyond defaults.
- Supply lightweight inline SVG icons for gear and wrench to avoid external dependencies.

## Data Flow

```text
[Gear Button] --click--> [HudToggleDrawer:settings] --dispatch--> useUiStore.togglePostprocessing()
                                                         \--> useUiStore.toggleHudHealthBars()
                                                         \--> useUiStore.toggleAiV2()

[Wrench Button] --click--> [HudToggleDrawer:debug] --dispatch--> useUiStore.toggleAiDebug()
                                                          \--> useUiStore.toggleExplosionDebug()

[useUiStore.postprocessingEnabled] --> Battlefield (toggles BloomProvider)
[useUiStore.aiV2Enabled] --> AI runtime + overlays
[useUiStore.aiDebugEnabled/explosionDebugEnabled] --> overlay visibility
```

## Interfaces

```typescript
interface HudToggleDefinition {
  id: string;
  label: string;
  description?: string;
  isActive: () => boolean;
  onToggle: () => void;
  disabled?: () => boolean;
}

interface HudToggleDrawerProps {
  label: string; // Accessible label for the trigger button
  icon: React.ReactNode; // SVG icon rendered inside the trigger
  toggles: HudToggleDefinition[];
  alignment?: 'left' | 'right';
}
```

- `HudToggleDrawer` owns local `isOpen` state and sets `aria-expanded` / `aria-controls` on the trigger button.
- Each toggle row renders a button with `role="switch"`, `aria-checked`, and optional helper text.
- Drawers close when clicking the trigger again or pressing `Escape` while focused inside the panel.

## Data Models

- `useUiStore` additions/changes:
  - `postprocessingEnabled: true` (default)
  - `aiV2Enabled: true` (default)
  - `hudHealthBarsEnabled` remains `false` by default
  - `aiDebugEnabled` and `explosionDebugEnabled` remain `false` by default
  - Optional: ephemeral fields `settingsDrawerOpen`/`debugDrawerOpen` are unnecessary because drawers will manage local UI state; store stays focused on simulation toggles.
- Toggle registry arrays exported from a new `src/ui/hudToggleConfig.ts` module to keep definitions centralized.

## Error Handling Matrix

| Scenario                                                                               | Detection                                                          | User Impact                        | Handling Strategy                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `useUiStore` selector throws because store is undefined (React tree mis-mounted)       | React runtime error boundary                                       | HUD drawers fail to render         | Maintain existing safety: `Hud` already mounts inside providers; no new risk introduced.                      |
| Toggle handler runs while `useGameState` context is null (e.g., before initialization) | Handler still updates UI state; dependent systems guard null state | None; toggles update UI store only | No action required; toggles remain safe.                                                                      |
| Postprocessing toggle is disabled while Bloom pipeline fails to mount                  | `PostprocessingLazy` or `BloomProvider` throws                     | Visual effects disappear           | Drawer retains toggle state; errors bubble to existing error boundaries. Provide fallback logging (existing). |
| Debug overlay toggles engaged while overlays not mounted                               | Overlay components return `null` when disabled                     | No debug overlay visible           | Config-driven toggles only flip store flags; overlays already guard on flags.                                 |

## Testing Strategy

- **Unit (Vitest + React Testing Library):**
  - `ui-store-defaults.spec.ts` validates new store defaults and mirrors configuration overrides.
  - `ui-settings-panels.spec.tsx` renders `HudToggleDrawer` with settings config, simulates clicks, checks ARIA, state updates, and nested toggle invocation.
  - `ui-debug-panels.spec.tsx` mounts with debug config, ensures toggles dispatch, verifies disabled states when AI V2 is off.
- **Integration:**
  - Update existing HUD Playwright flow (if available) to open drawers and capture toggles; otherwise add follow-up task for automation (out of scope here but documented).
- **Regression:**
  - Ensure `Controls` snapshot/test adjustments reflect removed buttons (if snapshots exist).

## Implementation Notes

- Keep drawer DOM within `.hud-panel` to inherit styling and pointer-events.
- Provide keyboard support: trigger must be focusable, panel traps focus via `tabIndex={-1}` sentinel and closes on `Escape`.
- Use CSS variables / modifiers (e.g., `.hud-drawer`, `.hud-drawer__toggle`) for maintainable styling.
- Document toggle definitions with inline comments to guide future extension (e.g., add `registerDebugToggle` helper later if dynamic registration becomes necessary).

```
