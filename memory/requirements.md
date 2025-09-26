# Requirements — Star Disk Shader Integration

## 2025-09-26 — Main Sequence Star Shader Integration

1. **WHEN** the celestial environment renders with the star disk feature enabled, **THE SYSTEM SHALL** instantiate the `mainsequencestar` fragment shader (adapted from Shadertoy) without requiring runtime parameter overrides. *(Acceptance: `test/vitest/star-disk-material.spec.ts` asserts the created `ShaderMaterial.fragmentShader` matches the imported GLSL and seeded uniforms align with expectations.)*
2. **WHEN** the star disk shader updates each frame, **THE SYSTEM SHALL** drive the `iTime` and `iResolution` uniforms from deterministic simulation time and the current renderer pixel dimensions. *(Acceptance: `test/vitest/star-disk-material.spec.ts` updates uniforms and verifies deterministic time advances and resolution clamping.)*
3. **WHEN** the shader samples its channels, **THE SYSTEM SHALL** bind the organic texture asset to `iChannel0` and the noise texture asset to `iChannel1`, falling back to deterministic generated textures if loading fails. *(Acceptance: `test/vitest/star-disk-material.spec.ts` validates both provided textures and generated fallback textures.)*
4. **WHEN** shader allocation fails, **THE SYSTEM SHALL** fall back to a basic emissive mesh material and emit a warning without crashing the scene graph. *(Acceptance: `test/vitest/star-disk.component.spec.tsx` mocks the factory failure and asserts the component renders `<meshBasicMaterial>` while logging the warning.)*

## 2025-09-27 — Build/Test Resilience

1. **WHEN** the Vitest smoke import suite enumerates project modules, **THE SYSTEM SHALL** load each module through bundled dynamic imports so TypeScript sources resolve without runtime extension errors. *(Validation: `test/vitest/smoke/import_all.spec.ts` passes with all modules imported.)*
2. **WHEN** `ProjectileObject` renders for any projectile entity, **THE SYSTEM SHALL** derive the sphere geometry radius from that entity’s projectile configuration or the default fallback. *(Validation: projectile geometry specs capture the configured radius for laser and heavy projectiles.)*
3. **WHEN** webpack’s TypeScript loader evaluates Vitest specs during `npm run build`, **THE SYSTEM SHALL** narrow error objects before reading their properties so compilation completes without type errors. *(Validation: `npm run build` finishes without TypeScript diagnostics.)*
4. **WHEN** projectile geometry tests exercise React hooks, **THE SYSTEM SHALL** provide stable mocked hooks that avoid invalid dispatcher access. *(Validation: projectile geometry specs run without `Invalid hook call` failures.)*

## EARS Statements

1. **WHEN** the celestial environment renders with `features.starDisk !== false`, **THE SYSTEM SHALL** draw the star disk using the main sequence shader material anchored to `StarLight` configuration. *(Validation: visual snapshot shows shader-driven corona.)*
2. **WHEN** simulation time advances, **THE SYSTEM SHALL** drive shader animation uniforms from deterministic simulation time. *(Validation: unit assertion on uniform builder.)*
3. **WHEN** bloom post-processing is enabled, **THE SYSTEM SHALL** register the star disk with a dedicated bloom group so only intended pixels bloom. *(Validation: component test checks bloom registration.)*
4. **WHEN** shader compilation or uniform initialisation fails, **THE SYSTEM SHALL** fall back to the basic material and log a warning. *(Validation: forced failure test asserts fallback path.)*
5. **WHEN** `StarLight` color or intensity change, **THE SYSTEM SHALL** reflect the new lighting on the disk within the same frame. *(Status: open follow-up—no automated coverage yet; track as future enhancement.)*

## Legacy Star Disk Configuration (superseded by TASK134)

These historical requirements described behaviors tied to the deprecated `StarDiskShaderConfig`, debug overrides (`window.__STAR_DISK_DEBUG__`), and camera framing captured via Playwright before/after snapshots. The migration to the `mainsequencestar` shader retired those code paths; retain this section for archival reference only.


## 2025-09-26 — Planet Shadowing

1. **WHEN** a planet mesh renders under the configured directional star light, **THE SYSTEM SHALL** shade the hemisphere facing away from the light darker than the lit side using physically based lighting. *(Acceptance: viewport inspection confirms a terminator band and unit test asserts rim material retains standard lighting chunks.)*
2. **WHEN** star light intensity or direction changes, **THE SYSTEM SHALL** propagate the new lighting to both standard and rimmed planet materials within the same render frame. *(Acceptance: unit test verifies materials receive updated uniforms and manual render shows lighting shift.)*
3. **WHEN** rim glow is enabled for a planet, **THE SYSTEM SHALL** preserve the rim accent while respecting light-derived shading. *(Acceptance: shader unit test confirms rim contribution adds on top of the lit color instead of replacing it.)*
4. **WHEN** planet meshes are part of the celestial environment, **THE SYSTEM SHALL** allow them to cast and receive shadows from the star light. *(Acceptance: renderer configuration shows `castShadow`/`receiveShadow` enabled and Playwright capture displays occlusion on nearby bodies.)*
