# Release Notes - Health Bar Prototype Fix

What changed
- Deferred adding health-bar instanced meshes to the `healthBarsGroup` to avoid early visible prototype geometry during renderer initialization.
- Hid ship instancer prototype parent groups by default to prevent prototype meshes from briefly rendering.

Why
- Early `.add()` calls caused prototype geometry (health-bar-like meshes) to appear near the world boundary in the rendered scene. Deferring `.add()` ensures renderer and camera are initialized before adding visible instanced meshes.

Implementation details
- `src/renderer/healthBarInstancer.ts`: added `deferAddToParent` helper and replaced direct `parent.add(instancedMesh)` calls with deferred adds.
- `src/renderer/shipInstancer.ts`: set prototype `parentGroup.visible = false` in `createGroup()` (minimal reversible change).

Verification
- Ran `npm run build-standalone` and executed an automated headless probe (`.tmp/headless-hb-probe.mjs`) against the running server to collect provenance stacks, JSON listings, and screenshots. Screenshots saved to `.tmp/probe_screenshot_after.png` and `.tmp/probe_screenshot_after2.png` show the artifact removed in verification runs.

Revert
- Both changes are intentionally small and reversible: remove the deferred add helper (restore `parent.add`) and/or restore `parentGroup.visible` to true to revert to previous behavior.

Notes
- If any artifact remains, we can either (a) also defer or guard legacy non-instanced health bar creation in `meshFactory`, or (b) delay enabling instanced meshes until the first render frame where camera is guaranteed available.
