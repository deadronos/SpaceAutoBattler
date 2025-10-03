# Copilot Processing Notes: Shield Bloom Fix

**Status:** Regression fixed (2025-10-03)

## Summary

Shields were disappearing when postprocessing (selective bloom) was enabled. Root cause: BloomProvider disables material.colorWrite for transparent materials registered for selective bloom to avoid double-drawing artifacts. Shields are transparent and often have depthWrite=false; without writing to the main color buffer they could be invisible when bloom thresholds/intensity are not sufficient to pick them up. This caused the visual regression seen with PP on.

## Decision

- Implemented a targeted opt-out: shield materials now set `userData.__copilot_forceColorWrite = true`. BloomProvider respects this flag and will not disable colorWrite for materials that explicitly request to keep writing to the main pass.

## Rationale

- Minimal and low-risk: avoids global changes to bloom thresholds that could alter many effects.
- Preserves BloomProvider logic (still disables colorWrite for other bloom-only elements) while guaranteeing critical gameplay visuals (shields) remain visible.
- Makes the rule explicit and discoverable (userData flag) for artists and future effects.

## Files changed

- `src/renderer/shields/shieldHexShader.tsx` — set the force-write flag on created ShaderMaterial instances.
- `src/renderer/shields/shieldMaterials.tsx` — set the force-write flag on MeshTransmissionMaterial instances via ref.
- `test/vitest/shield-material-forcewrite.spec.tsx` — unit test asserting factory sets the flag.
- `test/vitest/bloom-provider-shield-integration.spec.tsx` — integration test ensuring BloomProvider respects the flag.

## Follow-ups for designers / art team

- Optional per-hull bloom tuning: consider introducing per-hull bloomGroup overrides in `POSTPROCESSING_CONFIG.bloomGroups` to let designers tune threshold/intensity for shields per hull.
- Consider a visual debugging overlay to show which objects are rendered via main pass vs bloom-only (helpful when artist opt-ins are misconfigured).
- If you want shields to rely solely on bloom (e.g., extreme glow), provide an explicit `bloomOnly` configuration per-hull, with a designer-friendly fallback that prevents invisibility when bloom is disabled.

## Testing notes

- Added unit and integration tests that assert the opt-out behavior at the material and registration levels. The Playwright visual baseline will be added to capture the final visual verification (screenshots with PP on/off).

Decision record: Copilot-agent (automated) applied fix after TDD validation. Document changes in PR and link to baseline screenshots for reviewer verification.
