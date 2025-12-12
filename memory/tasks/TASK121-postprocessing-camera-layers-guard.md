# TASK121 - Postprocessing Camera Layers Guard

**Status:** Completed  
**Added:** 2025-12-12  
**Updated:** 2025-12-12

## Original Request

Fix a crash/bug where the Postprocessing composer render fails when `camera.layers` is missing on some camera objects (e.g., during tests or unusual camera exports). Ensure the composer renders gracefully and restores camera layer masks where applicable.

## Thought Process

The renderer previously assumed `camera.layers` is always present and attempted to read/restore `camera.layers.mask` during the bloom selection path, which throws when `camera.layers` is undefined or missing (test harnesses, mocked cameras). The fix should defensively guard against missing layers and only attempt to enable/restore masks when the API exists.

## Implementation Plan

- Update `src/components/Postprocessing.tsx` to check for `camera.layers` presence before reading/restoring the mask.
- Surround `bloomCtx.enableCameraLayers` calls with try/catch so precondition variance does not panic the composer loop. Use `reportMaterialError` for diagnostics if unexpected.
- Add Vitest UI tests (`test/components/postprocessing/bug-undefined-camera-layers.spec.tsx`) to validate composer.render is still called even when `camera.layers` is missing.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
|---|------------|-------|--------|------|
| 1.1 | Add defensive checks for `camera.layers` in Postprocessing | Complete | 2025-12-12 | Guarding `camera.layers` before accessing mask |
| 1.2 | Wrap `enableCameraLayers` in robust try/catch with diagnostics | Complete | 2025-12-12 | Avoids runtime throws and logs via reportMaterialError |
| 1.3 | Add unit test reproducing missing camera.layers path | Complete | 2025-12-12 | `test/components/postprocessing/bug-undefined-camera-layers.spec.tsx` added and passing |

## Progress Log

### 2025-12-12

- Added guards to Postprocessing; composer renders in test harness even with missing camera layers. Tests and typecheck pass.

*** EOF
