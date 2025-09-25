# Requirements — Star Disk Shader Integration

## EARS Statements

1. **WHEN** the celestial environment renders with `features.starDisk !== false`, **THE SYSTEM SHALL** draw the star disk using the new shader material anchored to `StarLight` configuration. *(Validation: visual snapshot shows shader-driven corona.)*
2. **WHEN** simulation time advances, **THE SYSTEM SHALL** drive shader animation uniforms from deterministic simulation time. *(Validation: unit assertion on uniform builder.)*
3. **WHEN** bloom post-processing is enabled, **THE SYSTEM SHALL** register the star disk with a dedicated bloom group so only intended pixels bloom. *(Validation: component test checks bloom registration.)*
4. **WHEN** shader compilation or uniform initialisation fails, **THE SYSTEM SHALL** fall back to the legacy basic material and log a warning. *(Validation: forced failure test asserts fallback path.)*
5. **WHEN** `StarLight` color or intensity change, **THE SYSTEM SHALL** update shader color/brightness uniforms within the same frame. *(Validation: renderer test inspects uniform updates after prop change.)*
