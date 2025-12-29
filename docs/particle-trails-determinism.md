# ParticleTrails Determinism Documentation

## Overview

The `ParticleTrails` component maintains full determinism for replay consistency and testing purposes.

## Implementation

### Seeded Random Number Generator

- **Location**: `src/components/ParticleTrails.tsx:38`
- **Seed**: `TRAIL_RNG_SEED = 0x54524149` ('TRAI' in ASCII)
- **Instance**: `rngRef = useRef(new SeededRng(TRAIL_RNG_SEED))`

The component uses a dedicated `SeededRng` instance that ensures all random behavior is deterministic and reproducible across multiple runs.

### Deterministic Properties

All particle properties that use randomness are generated using the seeded RNG:

1. **Backward Speed** (line 148)

   ```typescript
   const speed = backwardMin + rngRef.current.next() * (backwardMax - backwardMin);
   ```

2. **Lateral Jitter** (lines 149-150)

   ```typescript
   const jitterX = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
   const jitterY = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
   ```

3. **Longitudinal Jitter** (line 151)

   ```typescript
   const jitterZ = (rngRef.current.next() - 0.5) * 2 * longitudinalJitter;
   ```

4. **Lifetime Variation** (line 157)

   ```typescript
   const lifetimeJitter = 1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;
   trailResources.arrays.lifetime[idx] = lifetimeBase * lifetimeJitter;
   ```

5. **Scale Variation** (line 160-161)
   ```typescript
   trailResources.arrays.scale[idx] = 1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;
   // Produces values in range [1 - scaleJitter, 1 + scaleJitter]
   // Example: with scaleJitter=0.2, range is [0.8, 1.2]
   ```

### Memory Efficiency

The component follows performance best practices:

1. **Preallocated Temp Vectors**
   - `backward` vector (line 41) is created once and reused
   - No `clone()` calls in hot paths
   - Anchor cache reuses Vector3 instances

2. **Ring Buffer Pattern**
   - Particles stored in fixed-size arrays
   - Ring buffer index wraps at `maxParticles`
   - No dynamic allocations during particle spawning

## Testing

Determinism is validated in `test/vitest/particle-trails-determinism.spec.tsx`:

### Test Coverage

1. ✅ **Identical output across multiple runs** - Same seed produces exact same particle data
2. ✅ **Consistent frame-to-frame behavior** - Particles maintain state correctly
3. ✅ **Position-based variation** - Different ship positions produce different (but deterministic) results
4. ✅ **RNG usage validation** - All random values use seeded RNG
5. ✅ **Multi-ship determinism** - Consistent behavior with multiple ships

### Running Tests

```bash
npm test -- particle-trails-determinism.spec.tsx
```

## Guarantees

### ✅ Determinism

- **No `Math.random()` usage** - All randomness uses `SeededRng`
- **Fixed seed** - Same seed always produces same sequence
- **No external state** - RNG state isolated to component

### ✅ Replay Consistency

- Same game state produces same particles
- Replays will show identical particle trails
- No non-deterministic behavior in any code path

### ✅ Performance

- No allocations in hot path
- Preallocated temp vectors
- Efficient ring buffer reuse

## Configuration

Particle behavior can be tuned via `PARTICLE_TRAILS_CONFIG` in `src/config/effects.js`:

- `spawnRatePerAnchor`: Particles per second per thruster
- `backwardSpeed.min/max`: Velocity range
- `lateralJitter`: Side-to-side randomness
- `longitudinalJitter`: Forward/backward randomness
- `scaleJitter`: Size and lifetime variation
- `lifetime`: Base lifetime in seconds

## Related Components

### useThrusterAnchors

- Computes thruster positions from ship models
- Also deterministic (no random behavior)
- Uses fallback positions when models unavailable

### trailResources

- GPU buffer management
- Instanced rendering for efficiency
- Shader-based animation

## Maintenance Notes

When modifying `ParticleTrails.tsx`:

1. ✅ Always use `rngRef.current.next()` for random values
2. ✅ Never use `Math.random()`
3. ✅ Avoid `clone()` in hot paths - reuse temp vectors
4. ✅ Run determinism tests to verify changes
5. ✅ Maintain ring buffer pattern for particles

## References

- Performance Review: `docs/performance-review-v2.0.5g.md`
- Task: `memory/tasks/TASK160-particle-trail-determinism.md`
- RNG Implementation: `src/utils/rng.ts`
- Config: `src/config/effects.js`
