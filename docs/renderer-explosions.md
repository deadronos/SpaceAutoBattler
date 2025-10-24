# Explosion Tuning Guide

This document outlines the explosion configuration system and provides guidelines for tuning explosion timing and intensity parameters.

## Overview

The explosion system uses faction-aware and hull-specific configuration to create visually distinct ship-kill effects. All timing and intensity parameters are configurable per faction (Alliance/Reavers) and hull size (Fighter → Carrier), allowing for nuanced visual storytelling.

## Configuration Structure

Explosion parameters are defined in `src/config/explosions.ts` via the `EXPLOSION_CONFIG` object:

```typescript
interface ExplosionConfigEntry {
  // Visual Properties
  baseRadius: number; // Base explosion radius (scaled by ship size)
  flashIntensity: number; // Initial flash brightness multiplier
  lightColor: ColorRepresentation; // Dynamic light color
  lightFalloff: number; // Light attenuation distance
  debrisCount: number; // Number of debris particles
  particleCounts: {
    // Particle counts by type
    sparks: number;
    plasma: number;
    smoke: number;
  };
  palette: {
    // Color palette for explosion stages
    flash: string; // Initial flash color
    shockwave: string; // Shockwave ring color
    fireballHot: string; // Hot fireball core color
    smoke: string; // Trailing smoke color
  };

  // Timing Properties (NEW)
  timing: {
    duration: number; // Total explosion duration (seconds)
    lightDuration: number; // Dynamic light duration (seconds)
    shockwave: {
      delay: number; // Shockwave start delay (seconds)
      duration: number; // Shockwave duration (seconds)
    };
    fireball: {
      delay: number; // Fireball start delay (seconds)
      duration: number; // Fireball duration (seconds)
    };
    debrisSpeed: [number, number]; // Min/max debris velocity range
  };
}
```

## Default Timing Values

The system provides these baseline timing patterns:

| Parameter          | Default | Fighter    | Corvette   | Frigate    | Destroyer  | Carrier    |
| ------------------ | ------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| Duration           | 1.8s    | 1.5-1.6s   | 1.65-1.75s | 1.8-1.9s   | 2.0-2.1s   | 2.2-2.4s   |
| Light Duration     | 0.25s   | 0.2-0.22s  | 0.22-0.25s | 0.25-0.27s | 0.28-0.3s  | 0.32-0.35s |
| Shockwave Delay    | 0.08s   | 0.06s      | 0.07s      | 0.08s      | 0.09s      | 0.1s       |
| Shockwave Duration | 0.32s   | 0.28-0.3s  | 0.3-0.32s  | 0.32-0.34s | 0.36-0.38s | 0.4-0.42s  |
| Fireball Delay     | 0.2s    | 0.17-0.18s | 0.18-0.19s | 0.19-0.2s  | 0.21-0.22s | 0.23-0.25s |
| Fireball Duration  | 0.4s    | 0.35-0.38s | 0.38-0.4s  | 0.4-0.42s  | 0.45-0.48s | 0.5-0.55s  |

_Note: Alliance tends toward shorter, cleaner explosions; Reavers favor longer, more dramatic effects._

## Tuning Workflow

### 1. Enable Debug Mode

Use the **Explosion Debug** toggle in the game controls to enable explosion parameter monitoring. This shows current config values and provides a foundation for future live-editing tools.

### 2. Identify Target Scenarios

Focus tuning on these key scenarios:

- **Fighter swarms** - Need quick, snappy explosions that don't overwhelm the scene
- **Capital ship kills** - Should feel significant and dramatic
- **Faction distinction** - Alliance (clinical, blue) vs Reavers (aggressive, orange)
- **Bloom interaction** - Ensure explosions enhance rather than wash out other effects

### 3. Parameter Guidelines

**Duration (Total Explosion)**

- **Recommended range:** 1.0-3.0 seconds
- **Performance cap:** Avoid >5 second durations (memory/GPU overhead)
- **Visual guideline:** Explosion should not outlast typical engagement timeframes

**Light Duration**

- **Recommended range:** 0.1-0.5 seconds
- **Bloom consideration:** Longer light duration increases bloom accumulation
- **Performance cap:** >1 second light duration can cause frame drops with multiple explosions

**Flash Intensity**

- **Recommended range:** 0.8-2.0
- **Bloom cap:** >2.5 can cause bloom washout; >3.0 may overwhelm entire scene
- **HDR consideration:** Values >1.5 work best with HDR-aware bloom thresholds

**Timing Relationships**

- **Shockwave delay** should be 0.03-0.15s to allow flash visibility
- **Fireball delay** should be 0.1-0.3s for realistic expansion sequence
- **Stage overlaps** create visual richness but increase GPU load

### 4. Testing Checklist

- [ ] **Single explosion** - Verify timing feels natural in isolation
- [ ] **Multiple explosions** - Test performance with 5-10 simultaneous explosions
- [ ] **Faction contrast** - Ensure Alliance/Reavers explosions feel distinct
- [ ] **Hull scaling** - Verify larger ships feel more impactful
- [ ] **Bloom balance** - Check that explosions don't overwhelm other bloom elements
- [ ] **Replay determinism** - Config changes only affect new explosions

## Bloom Considerations

The explosion system integrates with selective bloom via the `explosions` bloom group:

```typescript
// Current bloom settings (src/config/renderer.ts)
explosions: {
  intensity: 1.6,     // Bloom intensity multiplier
  smoothing: 0.035,   // Bloom edge smoothing
  threshold: 1.0,     // Minimum brightness for bloom
}
```

**Interaction Guidelines:**

- **Flash intensity** combines multiplicatively with bloom intensity
- **Light duration** affects bloom accumulation time
- **Particle counts** impact bloom coverage area
- **Safe flash range:** 0.8-1.8 with current bloom settings
- **Warning zone:** >2.0 flash intensity may cause bloom saturation

## Performance Guardrails

**Memory Limits:**

- Max 48 concurrent explosions (pool size)
- Debris particles scale with hull size but cap at ~30 per explosion
- Long durations increase average pool occupancy

**GPU Limits:**

- Dynamic lights are expensive; cap light duration at 0.5s for large battles
- High particle counts (>50 total) can impact mobile performance
- Bloom overdraw increases with flash intensity and shockwave radius

**Recommended Ranges:**

- **Total duration:** 1.0-2.5s (performance), up to 3.0s (dramatic effect)
- **Light duration:** 0.1-0.4s (standard), up to 0.5s (special cases only)
- **Flash intensity:** 0.8-1.8 (safe), 1.8-2.2 (dramatic), >2.2 (risky)
- **Particle totals:** <40 per explosion for mobile, <60 for desktop

## Live Reload Support

_Future Enhancement:_ The configuration structure supports hot-reload capability through:

- Config file watchers (development mode)
- Runtime parameter editors (debug UI)
- Per-explosion config overrides (testing)

Current implementation provides the foundation for these features while maintaining deterministic replay behavior.

## Troubleshooting

**Explosions feel too fast:**

- Increase `duration` and individual stage durations proportionally
- Verify shockwave/fireball delays allow proper visual sequencing

**Explosions wash out scene:**

- Reduce `flashIntensity` values
- Check bloom intensity settings in renderer config
- Consider shorter `lightDuration` to reduce bloom accumulation

**Performance issues with multiple explosions:**

- Reduce `particleCounts` values
- Shorten `lightDuration` (lights are expensive)
- Check total concurrent explosion count (max 48)

**Determinism issues:**

- Ensure config changes don't modify RNG consumption order
- Test replay with before/after config files
- Verify seed-based randomization remains consistent

## Reference Implementation

See `memory/design-explosionfx.md` for complete system architecture and visual stage specifications.
