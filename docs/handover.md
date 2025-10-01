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

## Cleanup performed in this change

The temporary debug helpers described above were removed or migrated to less-invasive mechanisms and the tests were updated accordingly. The following actions were taken in this change set:

1. Removed the dev-only window global from `BloomProvider`:
   - Deleted `window.__copilot_getSelectionLayerMask`. Tests now avoid querying internal masks and instead assert observable output where possible.

2. Retired composer debug flags and snapshot instrumentation in `Postprocessing`:
   - Removed writes to `__copilot_composerRendered` and `__copilot_postWritePerformed` from the composer render loop.
   - Dropped the `__copilot_enableComposerSnapshot` snapshot creation and consumption code paths.
   - Removed the `__copilot_injectPostWrite` (magenta scissor write) branch used for framebuffer verification.

3. Tightened `StarDisk` instrumentation:
   - Stopped writing `__copilot_star_screenPos` to `window`. The on-screen projection remains available via a small DOM overlay element (`#copilot-star-screen-indicator`) with a `data-copilot-screen-pos` attribute so tests can query the visible position without relying on window globals.
   - Removed the internal GPU read path that wrote `__copilot_star_pixelRead`; tests now perform direct `readPixels` calls from the page context when required.

4. Tests updated:
   - `test/playwright/star-visibility.spec.ts` was updated to read the star overlay DOM marker and perform a page-context `readPixels` instead of polling window globals. It no longer sets `__copilot_enableComposerSnapshot`, `__copilot_injectPostWrite`, or queries `__copilot_getSelectionLayerMask`.
   - Unit tests touching `Postprocessing` and `BloomProvider` were adjusted to remain deterministic without the old debug signals.

## Validation status

Changes were validated locally:

- TypeScript typecheck: `npx tsc --noEmit` — passed.
- Unit tests (Vitest): `npm test` — all tests passed after test updates.
- Playwright tests: the `star-visibility.spec.ts` test was refactored to avoid global reads; it should be run in CI across browser projects to confirm deterministic behavior.

## Suggested follow-ups

- Consider adding a small testing utility (composable hook or React context) that exposes a promise which resolves after the composer completes a render cycle — this provides deterministic test synchronization without window globals.
- Run the Playwright suite across Chromium and WebKit in CI to ensure the new DOM-based sampling is stable on all platforms.
- If any of the other `__copilot_*` development helpers (e.g., WebGL log collectors) are no longer needed, migrate them behind a formal debug build flag or remove them in a follow-up cleanup.

Each of these changes is recorded in the git history. If any of the removed hooks are still required for future debugging, prefer a targeted, opt-in debug build flag or a test-only prop/context rather than window globals.
