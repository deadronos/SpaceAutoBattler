# renderer/shields/ - Shield Rendering

Specialized materials and shaders for rendering ship energy shields with impact effects.

## Shield Files

| File | Purpose |
|------|---------|
| **index.ts** | Main shield renderer export |
| **shieldMaterials.tsx** | React component for creating and managing shield materials |
| **shieldHexShader.tsx** | Hexagonal shield geometry and shader implementation |

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
