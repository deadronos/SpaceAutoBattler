# components/explosions/effectUpdaters/ - Explosion Effect Updaters

Modular particle effect updaters for different explosion visual components. Each updater manages a specific particle type with its own lifecycle and animation.

## Effect Updater Modules

| File                    | Purpose                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **flashUpdater.ts**     | Updates bright camera-facing spheres that provide initial flash of light; quickly fades out               |
| **shockwaveUpdater.ts** | Updates expanding ring/billboard effect simulating pressure wave; provides concentric ring visual         |
| **fireballUpdater.ts**  | Updates primary explosion ball with color transitions from hot (red/yellow) to cool (orange/black) colors |
| **debrisUpdater.ts**    | Updates rotating debris shards ejected radially outward; particles rotate and gradually fade              |
| **sparksUpdater.ts**    | Updates fast-moving spark particles scattering outward; camera-facing for visibility                      |
| **plasmaUpdater.ts**    | Updates rotating billboard plumes simulating energetic electrical discharge effect                        |
| **smokeUpdater.ts**     | Updates drifting smoke wisps that linger; camera-facing and gradually dissipate                           |
| **types.ts**            | Shared TypeScript types and interfaces for effect updaters (EffectUpdateContext, configuration)           |
| **index.ts**            | Exports all updater functions for easy importing                                                          |

## Updater Pattern

Each updater follows this interface:

```typescript
function updateEffectType(
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number,
): number;
```

**Parameters:**

- `ctx` - Update context with explosion data, timing, and particle cache
- `mesh` - Three.js InstancedMesh to update with particle data
- `startIndex` - Where in the mesh to start placing instances
- `capacity` - Maximum number of instances available

**Returns:** Number of active instances used

## Shared Context

`EffectUpdateContext` provides:

- Explosion position and initial velocity
- Elapsed time and total duration
- Seeded RNG for deterministic randomness
- Cached particle data
- Camera position for billboard calculations

## Performance Characteristics

- **Deterministic**: All particle positions/rotations are deterministic via seeded RNG
- **Cached**: Derived particle data computed once and reused
- **Pooled**: Particles pre-allocated at capacity limits
- **Efficient**: Matrix and color data updated in bulk
- **Camera-aware**: Billboard particles always face camera
