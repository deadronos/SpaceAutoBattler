# renderer/materials/ - Material Definitions

Material factories and builders for creating consistent Three.js materials used throughout the game.

## Material Files

| File | Purpose |
|------|---------|
| **index.ts** | Main export and material system orchestration |
| **materialFactory.ts** | Factory function for creating materials with consistent properties |
| **materialPresets.ts** | Pre-defined material presets for common use cases |
| **bulletMaterials.tsx** | Materials for projectile/bullet rendering |
| **explosionMaterials.tsx** | Materials for explosion particle effects |
| **muzzleMaterials.tsx** | Materials for muzzle flash effects |
| **thrusterMaterials.ts** | Materials for thruster/engine fire effects |

## Material Types

The system provides materials for:
- **Bullets/Projectiles** - Bright, emissive materials
- **Explosions** - Various particle materials (flash, smoke, debris)
- **Muzzle Flashes** - Bright flash effects
- **Thrusters** - Engine fire effects
- **Shields** - Shield glow and impact effects
- **Standard Objects** - General-purpose materials

## Material Registry Integration

All materials created through this system are registered in the material registry for:
- Caching and reuse
- Consistent properties
- Easy updates across entire scene
- Memory management

## Performance

- Materials cached to reduce object creation
- Pre-configured for optimal rendering
- Uses appropriate blending modes per effect type
- Registered with bloom system where appropriate
