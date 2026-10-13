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
| **types.ts**            | Shared types: `EffectUpdateContext`, `EffectUpdater`, `EffectUpdateResult`, `EMPTY_EFFECT_RESULT`         |
| **index.ts**            | Exports all updater functions for easy importing                                                          |

## Updater Pattern

Each updater follows the `EffectUpdater` type (`types.ts`):

```typescript
type EffectUpdater = (
  ctx: EffectUpdateContext,
  manager: InstancedLayerManager<number>,
  eventId: number,
) => EffectUpdateResult; // { count: number; saturated: boolean }
```

**Parameters:**

- `ctx` - Update context with explosion data, timing, and particle cache
- `manager` - Shared `InstancedLayerManager` used to allocate/write instances
- `eventId` - Identifier for the explosion event being updated

**Returns:** `EffectUpdateResult` with the number of active instances used
(`count`) and whether the layer's capacity was saturated (`saturated`).

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
