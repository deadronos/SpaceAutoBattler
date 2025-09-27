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

## 2025-09-27 — Star Disk View Compensation

1. **WHEN** the star disk component mounts with the feature enabled, **THE SYSTEM SHALL** orient the disk geometry using the configured star light direction instead of the active camera so the facing stays deterministic. *(Validation: `test/vitest/star-disk-orientation.spec.ts` verifies the helper quaternion maps local +Z to the configured direction and falls back to identity for invalid input.)*
2. **WHEN** the render loop advances with an active camera, **THE SYSTEM SHALL** compute a deterministic view-alignment vector per frame and push it into the star disk shader uniforms. *(Validation: `test/vitest/star-disk-material.spec.ts` exercises the new uniform update and confirms the values remain stable for mocked camera transforms.)*
3. **WHEN** the camera observes the star disk from glancing angles, **THE SYSTEM SHALL** adjust the shader’s radial falloff using the supplied view-alignment uniform so perceived corona brightness varies by no more than 10% relative to a head-on view. *(Validation: manual camera-orbit capture recorded in the star disk Playwright regression scenario; automated tolerance tracking pending follow-up task.)*

## 2025-09-28 — Star Disk Haze Taper

1. **WHEN** the star disk shader evaluates corona intensity beyond the inner 75% radius, **THE SYSTEM SHALL** apply a configurable taper curve that reduces haze contribution toward zero at the plane horizon. *(Acceptance: planned `test/vitest/star-disk-haze-taper.spec.ts` asserts the fragment helper outputs a zeroed haze factor at the configured horizon threshold.)*
2. **WHEN** the view-alignment uniform reports a facing cosine below the `edgeFadeThreshold`, **THE SYSTEM SHALL** clamp the haze multiplier so the visible rim brightness does not exceed the core brightness by more than 10%. *(Acceptance: unit test extends `test/vitest/star-disk-material.spec.ts` to validate clamped multiplier calculations with mocked facing inputs.)*
3. **WHEN** `CelestialEnvironmentConfig.starDisk.haze` overrides the default taper strength, **THE SYSTEM SHALL** propagate the new scalar to shader uniforms within the same render frame. *(Acceptance: component test in `test/vitest/star-disk.component.spec.tsx` mutates the config and observes the updated uniform payload.)*
4. **WHEN** shader compilation or uniform initialisation for haze taper fails, **THE SYSTEM SHALL** fall back to the prior view-compensated shader path while logging a warning and maintaining deterministic output. *(Acceptance: negative-path unit test in `test/vitest/star-disk-material.spec.ts` mocks uniform injection failure and asserts warning plus fallback behavior.)*

## 2025-09-27 — Star Disk Boundary Feather

1. **WHEN** the star disk boundary feather radius decreases via configuration, **THE SYSTEM SHALL** drive the fragment alpha below 0.01 before the billboard radius to avoid a hard edge. *(Acceptance: `test/vitest/star-disk-boundary.spec.ts` samples the shader helper and asserts the alpha falls below the target threshold at the configured radius.)*
2. **WHEN** boundary feathering is disabled (radius ≥ 0.999 or alpha floor ≥ 0.99), **THE SYSTEM SHALL** match the legacy alpha output within 1% tolerance. *(Acceptance: `test/vitest/star-disk-material.spec.ts` compares the resulting uniform vector against the legacy baseline and confirms the legacy curve.)*
3. **WHEN** runtime configuration hot-reloads, **THE SYSTEM SHALL** update the boundary feather uniforms on the next frame without re-instantiating the material. *(Acceptance: `test/vitest/star-disk.component.spec.tsx` mutates the environment config and expects the uniforms to change in place.)*
4. **WHEN** the camera approaches a grazing angle, **THE SYSTEM SHALL** clamp feather calculations to finite numbers and avoid NaNs. *(Acceptance: `test/vitest/star-disk-boundary.spec.ts` feeds extreme facing values through the uniform updater and asserts finite vector components.)*
5. **WHEN** the feather exponent increases, **THE SYSTEM SHALL** maintain a continuous alpha derivative across the curve to prevent banding. *(Acceptance: `test/vitest/star-disk-boundary.spec.ts` samples contiguous radii and checks monotonic decrease without discontinuities.)*

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

## 2025-09-27 — HUD Health Overlay Enhancements

1. **WHEN** the HUD health-bar toggle in the top menu is set to `on`, **THE SYSTEM SHALL** render per-ship overlay widgets for all visible player and AI vessels within the next render frame. *(Acceptance: planned Playwright flow in `test/playwright/hud-healthbars.spec.ts` activates the toggle and asserts overlays appear for each tracked entity.)*
2. **WHEN** a ship overlay renders, **THE SYSTEM SHALL** display stacked shield and health bars using the configuration colors (default: blue shield, green health) with proportions reflecting the entity’s current normalized shield/health values. *(Acceptance: Vitest snapshot in `test/vitest/hud-overlay-layout.spec.ts` mounts the component and verifies bar lengths and color tokens for seeded states.)*
3. **WHEN** a tracked ship’s shield or health value changes by ≥1% of max, **THE SYSTEM SHALL** animate the corresponding bar width to the new value within 150ms while preserving deterministic easing from the seeded RNG utilities. *(Acceptance: unit test in `test/vitest/hud-overlay-animation.spec.ts` simulates value deltas and checks transition timing and easing seeded outputs.)*
4. **WHEN** status effects (e.g., jammed, shield-down, engine-disrupted) are active on a ship, **THE SYSTEM SHALL** surface iconography and tooltip text adjacent to the overlay with contrast ratios meeting WCAG 2.1 AA (≥4.5:1) against the in-scene background. *(Acceptance: visual assertion in `test/vitest/hud-status-icons.spec.ts` measures computed contrast and presence of localized tooltip strings.)*
5. **WHEN** the HUD health-bar toggle is set to `off` or when overlays would overlap critical UI (radar, score banners), **THE SYSTEM SHALL** hide or reposition the overlays while maintaining accessibility-compliant alternatives in the top-level status ledger. *(Acceptance: Playwright regression toggles off the feature and asserts overlays disappear and the ledger updates with textual health summaries.)*
