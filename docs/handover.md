# Handover — Postprocessing / Selective Bloom Fix

This note captures the current state of the selective-bloom pipeline work and the instrumentation added to stabilize automated verification. It is intended for the next agentic AI session so the temporary debug hooks can be retired without losing the underlying fixes.

## Summary of the completed work

- Refactored `src/renderer/BloomProvider.tsx` to expose `enableCameraLayers` and `getSelectionLayerMask`, letting consumers (and tests) configure the camera deterministically for bloom groups.
- Updated `src/components/Postprocessing.tsx` to call the new BloomProvider helper each frame, ensuring the EffectComposer renders every bloom selection layer and restoring the previous mask afterward.
- Added deterministic runtime hooks to surface render progress (`__copilot_composerRendered`, `__copilot_postWritePerformed`) plus optional debugging toggles (`__copilot_disablePostprocessing`, `__copilot_injectPostWrite`, `__copilot_enableComposerSnapshot`).
- Authored regression coverage: `test/vitest/bloom-provider-api.spec.ts` validates the camera mask API, and `test/playwright/star-visibility.spec.ts` now waits on the deterministic hooks to confirm the star disk survives postprocessing.

## Debug helpers currently in the codebase

| Location | Helper | Purpose |
| --- | --- | --- |
| `BloomProvider` | `window.__copilot_getSelectionLayerMask` | Allows Playwright to read the active bloom selection mask. |
| `Postprocessing` | `__copilot_composerRendered` | Timestamp written after each successful composer render. |
| `Postprocessing` | `__copilot_postWritePerformed` | Timestamp for the optional magenta scissor write that proves framebuffer access. |
| `Postprocessing` | `__copilot_injectPostWrite` flag | Enables the magenta quad write for diagnostics. Disabled by default. |
| `Postprocessing` | `__copilot_enableComposerSnapshot` flag | Captures pre/post render metadata for troubleshooting. |
| `Postprocessing` | `__copilot_disablePostprocessing` flag | Lets tests bypass the composer entirely. |
| `StarDisk` (component-level) | `__copilot_star_screenPos` | Exposes CSS/device pixel coordinates for the star sample location used in Playwright diagnostics. |

These helpers deliver deterministic signals for automation and are safe while left dormant, but they add surface area and console noise if toggled manually.

## Recommended cleanup steps

1. **Remove window globals from BloomProvider.**
	- Delete the dev-only `__copilot_getSelectionLayerMask` attachment.
	- Update the Playwright spec to derive expectations directly from the page context (e.g., via `page.evaluate` calling `bloomCtx.enableCameraLayers` with an instrumented camera) or assert observable pixels instead.

2. **Retire composer debug flags.**
	- Remove the `__copilot_composerRendered` and `__copilot_postWritePerformed` writes from the postprocessing `useFrame` handler.
	- Simplify the Playwright test to rely on visible output or an exposed testing hook exposed via React context (e.g., promise returned by a testing-only prop).

3. **Delete the magenta scissor write path.**
	- Drop the `__copilot_injectPostWrite` branch and associated logging once the test no longer requires framebuffer manipulation.
	- Remove `__copilot_enableComposerSnapshot` snapshot support unless debugging proves it still valuable in CI; it presently exists solely for optional instrumentation.

4. **Tighten StarDisk instrumentation.**
	- Remove the `__copilot_star_screenPos` export if the test moves away from pixel sampling.
	- If positional data remains useful, prefer a testing prop or context rather than a window global.

Each deletion should be accompanied by corresponding test updates so CI remains green. Consider introducing targeted testing utilities (e.g., a composable hook that returns a promise once the composer renders) to preserve determinism without global state.

## Validation state

- Last verified with `npx playwright test test/playwright/star-visibility.spec.ts -c playwright.config.cjs --project=firefox --reporter=list` (passes).
- Unit expectation covered by `test/vitest/bloom-provider-api.spec.ts` (included in standard `npm test`).
- No additional builds or type checks were necessary for this documentation update.

## Suggested next actions

- Schedule the cleanup described above once long-term confidence in the tests is achieved.
- Run the Playwright suite across Chromium/WebKit after removing globals to confirm determinism without platform-specific hooks.
- Decide whether the composer snapshot or magenta write offer ongoing value; if so, migrate them behind a formal debug build flag rather than window globals.

Please leave this handover in place (updating as progress continues) so future agents can assess whether the temporary instrumentation is still required.
