# Requirements — Star Disk Shader Integration

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
