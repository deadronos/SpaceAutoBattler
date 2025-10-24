# Explosion Renderer Module

## Overview

The explosion renderer system has been refactored into a modular architecture for better testability, maintainability, and code clarity. The system renders multiple visual effects for ship explosions using Three.js instanced meshes.

## Architecture

### Core Components

#### `ExplosionRendererCore.tsx`

Top-level React component that:

- Manages refs to all instanced meshes
- Orchestrates the frame loop via `useFrame`
- Delegates per-effect updates to specialized updater functions
- Finalizes mesh state each frame

#### `instancedManager.ts`

Utility module providing helper functions for:

- Setting instance counts
- Marking matrices and colors as dirty
- Batch finalizing all meshes

#### `effectUpdaters/`

Individual modules for each effect type:

- **flashUpdater.ts** - Bright camera-facing spheres that quickly fade
- **shockwaveUpdater.ts** - Expanding ring billboards
- **fireballUpdater.ts** - Transitioning spheres (hot to cool colors)
- **debrisUpdater.ts** - Rotating shards ejected from explosion
- **sparksUpdater.ts** - Fast-moving camera-facing particles
- **plasmaUpdater.ts** - Rotating billboard plumes
- **smokeUpdater.ts** - Drifting camera-facing wisps

Each updater exports a pure function with signature:

```typescript
(ctx: EffectUpdateContext, mesh: InstancedMesh, startIndex: number, capacity: number) => number;
```

Returns the number of instances used.

### Supporting Modules

#### `derived.ts`

Pure helper module providing:

- `getDerived()` - Cached deterministic particle generation using seeded RNG
- `getCachedColor()` - Color instance caching
- `randomUnitVector()` - Unit vector generation
- `easeOutQuad()`, `clamp01()` - Math utilities

#### `materials.ts`

Resource management hook `useExplosionResources()` that creates and manages:

- Geometries (spheres, rings, planes, tetrahedrons)
- Materials (basic, standard, with appropriate blending modes)
- Cleanup on unmount

#### `constants.ts`

Configuration constants for:

- Capacities per effect type
- Timing delays and durations
- Particle count limits

## Data Flow

```
ExplosionRendererCore
  ↓ (each frame)
  ├─ For each explosion event:
  │   ├─ Get derived particles (cached)
  │   ├─ Create EffectUpdateContext
  │   └─ Call effect updaters
  │       ├─ updateFlash()
  │       ├─ updateShockwave()
  │       ├─ updateFireball()
  │       ├─ updateDebris()
  │       ├─ updateSparks()
  │       ├─ updatePlasma()
  │       └─ updateSmoke()
  └─ Finalize all meshes (counts, dirty flags)
```

## Testing

### Unit Tests

Located in `test/components/explosions/`:

- **derived.spec.ts** - Tests for helper functions and caching
- **instancedManager.spec.ts** - Tests for mesh management utilities
- **effectUpdaters/\*.spec.ts** - Tests for each effect updater

All updaters are tested for:

- Correct instance count based on timing
- Deterministic behavior with seeded RNG
- Proper matrix and color updates
- Edge cases (before delay, after duration, capacity limits)

### Test Coverage

Current coverage: >80% for new explosion modules

### Running Tests

```bash
npm test -- test/components/explosions
```

## Performance Characteristics

- **Instanced Rendering**: All effects use InstancedMesh for efficient rendering
- **Cached Derivations**: Particle properties cached per explosion event
- **Bloom Groups**: Flash, shockwave, and fireball registered for selective bloom
- **Frustum Culling**: Disabled for explosion meshes (short-lived, dynamic)

## Backward Compatibility

The original `ExplosionRenderer.tsx` now re-exports from `ExplosionRendererCore.tsx`:

```typescript
export {
  ExplosionRendererCore as ExplosionRenderer,
  ExplosionsLayer,
} from './explosions/ExplosionRendererCore.js';
```

Existing code importing `ExplosionsLayer` will continue to work without changes.

## Migration Guide

For new code, prefer importing directly from the core:

```typescript
// Old (deprecated but still works)
import { ExplosionsLayer } from './ExplosionRenderer.js';

// New (preferred)
import { ExplosionsLayer } from './explosions/ExplosionRendererCore.js';
```

## Future Enhancements

Potential areas for extension:

- Additional effect types (electrical arcs, emp pulses)
- Per-faction visual variations
- Performance profiling and optimization
- VFX quality settings (low/medium/high)
- Effect pooling for better memory management
