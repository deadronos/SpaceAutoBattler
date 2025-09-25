# Requirements — Memory Bank Refresh

## Context

This document captures the testable requirements for updating the `memory/` knowledge base so it reflects the current celestial environment feature set and repository structure on branch `celestialenvironment`.

## EARS Requirements

1. **WHEN** the memory bank documents current work focus, **THE SYSTEM SHALL** summarise active initiatives around the celestial environment renderer (lighting, planetary assets, and tests) and de-emphasise legacy AI V2 rollout notes.  
   _Acceptance:_ `memory/activeContext.md` highlights celestial environment deliverables and no longer lists AI V2 rollout as an active next step.

2. **WHEN** repository changes land that supersede older notes, **THE SYSTEM SHALL** remove or replace outdated entries in `memory/progress.md` so the most recent updates describe celestial environment tasks completed through 2025-09-25.  
   _Acceptance:_ The top section of `memory/progress.md` is rewritten with at least three dated entries from September 2025 describing texture hooks, rim material, lighting, and tests.

3. **WHEN** task records exist under `memory/tasks/`, **THE SYSTEM SHALL** ensure the index and individual files reflect their true status (Completed vs In Progress) and content matches files present on disk.  
   _Acceptance:_ `memory/tasks/_index.md` lists completed tasks referencing the `COMPLETED/` subfolder, and any entries marked “In Progress” have either been updated or moved out of the completed list.

4. **WHEN** core reference documents exist for engine subsystems, **THE SYSTEM SHALL** create or update dedicated memory files covering the celestial environment module (config schema, components, hooks, and tests).  
   _Acceptance:_ At least one new `memory/core-*.md` file explains celestial environment structure and is cross-linked or referenced in `progress.md`.

5. **WHEN** errors occur while loading planet textures or rendering the environment, **THE SYSTEM SHALL** document expected mitigations in an error matrix to guide triage.  
   _Acceptance:_ `design.md` (Error Handling section) includes an error matrix with detection, impact, and mitigation rows for texture, shader, and performance failures.

## Star Disk Shader Control Exposure — 2025-09-26

1. **WHEN** new star disk shader configuration fields are provided in `CelestialEnvironment`, **THE SYSTEM SHALL** clamp each value into safe ranges before uniforms are built.  
   _Acceptance:_ `buildStarDiskMaterialConfig` clamps the new intensity, tiling, and scrolling properties with coverage in Vitest.

2. **WHEN** the star disk material is created or updated, **THE SYSTEM SHALL** forward every exposed configuration field into matching shader uniforms.  
   _Acceptance:_ `createStarDiskMaterial` and `updateStarDiskUniforms` set `uCoreStrength`, `uOrganicTiling`, and related uniforms, verified in Vitest lifecycle tests.

3. **WHEN** the fragment shader renders the star disk, **THE SYSTEM SHALL** respect the new uniforms so changing config values alters the visual output without breaking fallbacks.  
   _Acceptance:_ `starDisk.fragment.glsl` multiplies colour, corona, glow, and texture coordinates by the new uniforms, and fallback texture tests keep brightness > 0.

4. **WHEN** maintainers review default environment tuning, **THE SYSTEM SHALL** describe what each new shader control adjusts in the appearance.  
   _Acceptance:_ `CELESTIAL_ENVIRONMENT.starDisk.shader` inline comments explain the impact of core, rim, corona, glow, tiling, and scrolling controls.

## Star Disk Palette Offsets — 2025-09-26

1. **WHEN** palette offsets are supplied in `StarDiskShaderConfig`, **THE SYSTEM SHALL** clamp hue, saturation, and lightness adjustments to safe ranges before applying them.  
   _Acceptance:_ `buildColorPalette` clamps palette offset components between -1 and 1 and the behavior is covered by Vitest assertions.

2. **WHEN** explicit palette offsets are provided, **THE SYSTEM SHALL** apply them only when the corresponding colour override (`colorCore`, `colorPrimary`, `colorSecondary`) is absent.  
   _Acceptance:_ Vitest verifies derived colours change when offsets are configured and remain unchanged when explicit hex overrides are supplied.

3. **WHEN** no palette offsets are provided, **THE SYSTEM SHALL** default to the fiery baseline skew previously hard-coded in the shader helper.  
   _Acceptance:_ Default offsets in `CELESTIAL_ENVIRONMENT.starDisk.shader` reproduce the prior palette and are documented inline.

4. **WHEN** designers adjust palette offsets, **THE SYSTEM SHALL** ensure derived colours stay within valid colour space bounds to avoid NaN or wrap-around artefacts.  
   _Acceptance:_ Vitest guard rails check that the resulting HSL values remain within the 0–1 range and the shader renders without warnings.
