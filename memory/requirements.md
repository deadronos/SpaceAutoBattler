# Requirements — Star Disk Shader Integration

## 2025-09-27 — Build/Test Resilience

1. **WHEN** the Vitest smoke import suite enumerates project modules, **THE SYSTEM SHALL** load each module through bundled dynamic imports so TypeScript sources resolve without runtime extension errors. *(Validation: `test/vitest/smoke/import_all.spec.ts` passes with all modules imported.)*
2. **WHEN** `ProjectileObject` renders for any projectile entity, **THE SYSTEM SHALL** derive the sphere geometry radius from that entity’s projectile configuration or the default fallback. *(Validation: projectile geometry specs capture the configured radius for laser and heavy projectiles.)*
3. **WHEN** webpack’s TypeScript loader evaluates Vitest specs during `npm run build`, **THE SYSTEM SHALL** narrow error objects before reading their properties so compilation completes without type errors. *(Validation: `npm run build` finishes without TypeScript diagnostics.)*
4. **WHEN** projectile geometry tests exercise React hooks, **THE SYSTEM SHALL** provide stable mocked hooks that avoid invalid dispatcher access. *(Validation: projectile geometry specs run without `Invalid hook call` failures.)*

## EARS Statements

1. **WHEN** the celestial environment renders with `features.starDisk !== false`, **THE SYSTEM SHALL** draw the star disk using the new shader material anchored to `StarLight` configuration. *(Validation: visual snapshot shows shader-driven corona.)*
2. **WHEN** simulation time advances, **THE SYSTEM SHALL** drive shader animation uniforms from deterministic simulation time. *(Validation: unit assertion on uniform builder.)*
3. **WHEN** bloom post-processing is enabled, **THE SYSTEM SHALL** register the star disk with a dedicated bloom group so only intended pixels bloom. *(Validation: component test checks bloom registration.)*
4. **WHEN** shader compilation or uniform initialisation fails, **THE SYSTEM SHALL** fall back to the legacy basic material and log a warning. *(Validation: forced failure test asserts fallback path.)*
5. **WHEN** `StarLight` color or intensity change, **THE SYSTEM SHALL** update shader color/brightness uniforms within the same frame. *(Validation: renderer test inspects uniform updates after prop change.)*

## 2025-09-25 — Aspect Ratio & Fiery Tuning

1. **WHEN** the viewport aspect ratio changes during rendering, **THE SYSTEM SHALL** preserve a circular star disk by compensating for aspect in the shader or geometry. *(Validation: unit test asserts the aspect uniform equals the reciprocal aspect and the rendered bounds remain symmetric.)*
2. **WHEN** default celestial environment configuration is applied, **THE SYSTEM SHALL** emit a high-energy ("fiery") corona by boosting shader intensity and texture blend parameters. *(Validation: material config test verifies boosted defaults for `coronaIntensity`, `textureMix`, and `textureFlicker`.)*
3. **WHEN** shader textures are unavailable, **THE SYSTEM SHALL** maintain the new fiery signature using fallback textures without introducing artifacts. *(Validation: existing fallback unit test updated to assert alpha/brightness remains within expected range.)*

## 2025-09-25 — Fiery Fidelity Refinement

1. **WHEN** the default star disk material config is created, **THE SYSTEM SHALL** expose a warm palette with an orange-red secondary color to match the art reference. *(Validation: unit test asserts the computed secondary color hue/lightness falls within the expected warm range.)*
2. **WHEN** shader textures are loaded, **THE SYSTEM SHALL** mix their high-frequency detail strongly into the corona so flame filaments remain visible. *(Validation: unit test verifies default `textureMix` and `textureFlicker` meet the new minimum thresholds.)*
3. **WHEN** the shader evaluates brightness, **THE SYSTEM SHALL** balance core and rim energy to prevent a washed-out disk. *(Validation: unit test checks that default brightness and corona intensity stay within the refined bounds.)*

## 2025-09-25 — Organic Radial Spread

1. **WHEN** `buildStarDiskMaterialConfig` resolves shader defaults, **THE SYSTEM SHALL** supply radial shaping uniforms (`textureRadialPower`, `coronaEdgeSoftness`, `baseFillStrength`) tuned for wide-disc animation. *(Validation: unit test asserts default uniform values match the new presets.)*
2. **WHEN** `StarDiskShaderConfig` overrides provide radial shaping values outside the supported range, **THE SYSTEM SHALL** clamp them back into safe bounds. *(Validation: unit test covers min/max clamping for each parameter.)*
3. **WHEN** star disk uniforms are refreshed at runtime, **THE SYSTEM SHALL** propagate the radial shaping uniforms to the existing material without recreation. *(Validation: unit test confirms `updateStarDiskUniforms` updates the new uniforms.)*

## 2025-09-26 — Star Disk Render Capture

1. **WHEN** the comparison Playwright suite runs with legacy overrides enabled, **THE SYSTEM SHALL** capture a `star-disk-before.png` baseline that applies the specified debug shader overrides. *(Acceptance: Playwright spec saves the before snapshot when executed with `--update-snapshots`.)*
2. **WHEN** the comparison suite runs without overrides, **THE SYSTEM SHALL** capture a `star-disk-after.png` baseline representing the default fuller-disc preset. *(Acceptance: Playwright spec saves the after snapshot on baseline update.)*
3. **WHEN** `window.__STAR_DISK_DEBUG__.shaderOverrides` is present prior to star disk material creation, **THE SYSTEM SHALL** merge those overrides into the shader config for the current session. *(Acceptance: Playwright spec verifies screenshot differences produced by overrides.)*

## 2025-09-26 — Star Disk Visibility

1. **WHEN** the battlefield scene loads with default camera settings, **THE SYSTEM SHALL** position the star light and disk within the initial camera frustum without reducing the configured star distance. *(Validation: visual inspection via Playwright capture shows the star disk in-frame.)*
2. **WHEN** the star light direction is updated for framing, **THE SYSTEM SHALL** maintain consistent lighting on celestial bodies. *(Validation: Vitest `celestial-environment.spec.ts` and manual capture confirm lighting remains stable.)*
3. **WHEN** Playwright capture workflows execute, **THE SYSTEM SHALL** continue generating distinct before/after screenshots despite the star repositioning. *(Validation: `star-disk-compare.spec.ts` passes and writes non-identical PNGs.)*

## 2025-09-26 — Planet Shadowing

1. **WHEN** a planet mesh renders under the configured directional star light, **THE SYSTEM SHALL** shade the hemisphere facing away from the light darker than the lit side using physically based lighting. *(Acceptance: viewport inspection confirms a terminator band and unit test asserts rim material retains standard lighting chunks.)*
2. **WHEN** star light intensity or direction changes, **THE SYSTEM SHALL** propagate the new lighting to both standard and rimmed planet materials within the same render frame. *(Acceptance: unit test verifies materials receive updated uniforms and manual render shows lighting shift.)*
3. **WHEN** rim glow is enabled for a planet, **THE SYSTEM SHALL** preserve the rim accent while respecting light-derived shading. *(Acceptance: shader unit test confirms rim contribution adds on top of the lit color instead of replacing it.)*
4. **WHEN** planet meshes are part of the celestial environment, **THE SYSTEM SHALL** allow them to cast and receive shadows from the star light. *(Acceptance: renderer configuration shows `castShadow`/`receiveShadow` enabled and Playwright capture displays occlusion on nearby bodies.)*
