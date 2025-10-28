# renderer/particles/ - Particle System Resources

Resources and utilities for particle effects including trails and thruster anchors.

## Particle Files

| File | Purpose |
|------|---------|
| **trailResources.ts** | Resources for particle trail effects (geometries, materials) |
| **useThrusterAnchors.ts** | React hook for managing thruster attachment points and anchor positions |

## Resources Provided

- **Geometries** - Pre-built geometries for particle rendering
- **Materials** - Particle-specific materials with appropriate blending
- **Anchors** - Attachment points for thrusters and trails

## Integration

- Particle trails rendered by ParticleTrails component
- Thruster anchors managed by ThrusterInstancedManager
- Resources pooled and cached for performance
- Used by effect systems for consistent appearance
