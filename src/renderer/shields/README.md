# renderer/shields/ - Shield Rendering

Specialized materials and shaders for rendering ship energy shields with impact effects.

## Shield Files

| File                            | Purpose                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| **index.ts**                    | Shield renderer export barrel (`ShieldHexMaterial`, `ShieldTransmissionMaterial`) |
| **shieldMaterials.tsx**         | `ShieldTransmissionMaterial` React component                                      |
| **shieldHexShader.tsx**         | `ShieldHexMaterial` React component; delegates uniform updates                    |
| **shieldHexMaterialFactory.ts** | Pure `createShieldHexShaderMaterial` factory (no React)                           |
| **shieldHexShaders.ts**         | Builds hex vertex/fragment shader source (ripple capacity)                        |
| **useShieldHexUniforms.ts**     | Per-frame hex uniform driver (time, opacity, tint, ripple data)                   |

## Shield System

Provides:

- Hexagonal shield geometry rendering
- Shield impact ripple effects
- Damage visualization via color changes
- Energy level feedback through material properties

## Shader Features

- Hexagonal pattern generation
- Ripple wave propagation
- Color-based damage feedback
- Shield strength visualization

## Integration

- Used by ShipShield component
- Color and ripple effects driven by ship state
- Responds to damage events from combat system
- Uses material registry for caching
