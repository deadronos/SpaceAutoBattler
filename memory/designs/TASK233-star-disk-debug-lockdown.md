# TASK233 — Star Disk Debug Lockdown

**Status:** Draft 2025-10-02  
**Confidence Score:** 0.9 (High — existing behavior is understood, changes are localized to `StarDisk.tsx`, and supporting tests can be added.)

## Overview

- Harden the StarDisk component so production builds never expose debug helpers or forced-on-top behavior unless an explicit debug flag is present.
- Centralize debug-mode detection, gate all helper registration behind it, and guarantee cleanup restores render state when debug mode is absent.
- Expand automated coverage to verify helpers appear only with `?copilot_debug=1` and that cleanup clears overlays/material overrides otherwise.

## Architecture Impact

- **Touched modules:** `src/components/environment/StarDisk.tsx`, new Vitest spec `test/vitest/star-disk-debug-lockdown.spec.tsx` (name TBD), existing Playwright spec relies on helpers when debug flag present (no change required besides new gating).
- **Primary pattern:** introduce a small local hook/utility inside `StarDisk` to memoize debug mode (URL flag) so we avoid repeated regex checks and can reuse in effects/frames.
- **Renderer contract:** default material path remains unchanged; debug-only helpers will now exist exclusively when flag evaluates true.

## Data Flow

```text
window.location.search --> isDebugEnabled
isDebugEnabled --> (useEffect/useFrame)
  ├─ register window helpers    (only when true)
  ├─ create DOM overlays        (only when true)
  └─ enforce cleanup / restore  (when false or on unmount)
```

- Frame loop reads `debugEnabled` and only honors helper requests when true.
- Cleanup effect runs when `debugEnabled` is false to revert prior overrides (render order, depth flags, overlay removal).

## Interfaces & Contracts

- **Debug helpers:**
  - Exported via `window.__copilot_*` only if `debugEnabled` and mesh exists.
  - Helpers must noop gracefully if mesh missing (existing behavior retained).
- **Component output:** JSX tree unchanged except the debug helper mesh subtree only renders when `debugEnabled`.
- **Side effects:** DOM overlay `#copilot-star-screen-indicator` created/destroyed only while debug enabled.

## Data Models

- `mesh.userData` keys (`__copilot_origMaterial`, `__copilot_forcedMaterial`, `__copilot_origLayerMask`) remain internal; ensure they are cleaned when debug disabled.
- No persistent store updates required.

## Error Handling Matrix

| Failure Mode                                           | Detection                                         | Response                                           | Notes                             |
| ------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| Shader material missing while debug helpers requested  | `shaderMaterialRef.current` null                  | Skip helper execution, log nothing                 | Existing defensive checks suffice |
| DOM overlay creation throws (e.g., document undefined) | `try/catch` around DOM ops                        | Swallow error; helpers remain disabled             | Behavior unchanged                |
| Window helper invocation without debug                 | `debugEnabled` false                              | Helpers not registered; requests ignored           | Verified via tests                |
| Residual forced material after debug                   | Cleanup effect runs with `debugEnabled === false` | Restore original material, dispose forced material | Covered by new tests              |

## Unit Testing Strategy

- **New Vitest suite** covering:
  1. Rendering without debug flag: ensure window helper functions are absent and the debug overlay is removed if pre-existing.
  2. Rendering with debug flag: confirm helper functions register after a frame tick and stay resident until unmount.
  3. Unmount after debug render: overlay (if present) and helper functions are cleared.
- Update existing component test mocks to expose `window`. Use `vi.stubGlobal` for window location search toggling between cases.
- Ensure tests reset `window.location` between runs to avoid bleed.

## Implementation Tasks

1. Add helper utility within `StarDisk.tsx` to memoize debug flag (`useMemo` + `useRef` cleanup) and expose boolean to effects.
2. Wrap all window helper registration/access (`__copilot_*`) within `if (debugEnabled)` blocks; remove redundant try/catch where possible while preserving safety.
3. Ensure cleanup effect also removes DOM overlay and forced material data when `debugEnabled` is false.
4. Add new Vitest spec for debug gating behavior; verify both debug-enabled and disabled scenarios.
5. Re-run `npx tsc --noEmit` and `npm test` (full suite) to confirm no regressions.

## Dependencies

- None external; relies only on existing StarDisk utilities.

## Out of Scope / Risks

- Playwright spec continues to rely on helpers when debug flag present—no change expected, but rerun spec manually if time permits.
- If future requirements demand tree-shaking debug helpers entirely, we may need bundler-level flags (not addressed here).
