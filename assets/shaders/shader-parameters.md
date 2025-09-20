# Shader Parameter Reference

This document provides recommended shader parameters for different explosion effects and how to configure them in the SpaceAutoBattler renderer system.

## Table of Contents

1. [Parameter Overview](#parameter-overview)
2. [Color Override Mapping](#color-override-mapping)
3. [Effect Presets](#effect-presets)
4. [Integration Examples](#integration-examples)
5. [Performance Guidelines](#performance-guidelines)

## Parameter Overview

### Core Shader Parameters

The billboard explosion shader accepts the following configurable parameters:

| Parameter        | Type  | Range       | Default           | Description                                         |
| ---------------- | ----- | ----------- | ----------------- | --------------------------------------------------- |
| `fadeInDuration` | float | 0.0-1.0     | 0.1               | How quickly particle fades in (normalized lifetime) |
| `fadeOutStart`   | float | 0.0-1.0     | 0.7               | When fade-out begins (normalized lifetime)          |
| `billboardScale` | float | 0.1-5.0     | 1.0               | Overall size multiplier                             |
| `softEdgePower`  | float | 1.0-5.0     | 2.2               | Power for soft-edge falloff (higher = sharper)      |
| `colorIntensity` | float | 0.0-3.0     | 1.2               | Overall color intensity multiplier                  |
| `colorStop1`     | vec3  | 0.0-1.0 RGB | [1.0, 0.98, 0.85] | Birth color (bright white-yellow)                   |
| `colorStop2`     | vec3  | 0.0-1.0 RGB | [1.0, 0.55, 0.0]  | Mid-life color (orange)                             |
| `colorStop3`     | vec3  | 0.0-1.0 RGB | [0.27, 0.0, 0.0]  | Death color (dark red)                              |
| `colorStop1Pos`  | float | 0.0-1.0     | 0.0               | Position of first color stop                        |
| `colorStop2Pos`  | float | 0.0-1.0     | 0.4               | Position of second color stop                       |
| `colorStop3Pos`  | float | 0.0-1.0     | 1.0               | Position of third color stop                        |

### Texture Parameters

| Parameter          | Type      | Description                          |
| ------------------ | --------- | ------------------------------------ |
| `explosionTexture` | sampler2D | Soft-circle texture (luminance mask) |

Recommended textures:

- `soft-circle-512.png` - Standard quality
- `soft-circle-256.png` - Performance optimized
- `soft-circle-1024.png` - High quality (use sparingly)

## Color Override Mapping

The `colorOverride` system maps directly to shader uniforms as follows:

### JavaScript to Shader Mapping

```javascript
// Input: colorOverride array
const colorOverride = ['#fffbda', '#ff8c00', '#440000'];

// Maps to shader uniforms:
// colorStop1 = vec3(1.0, 0.98, 0.85)  // #fffbda converted
// colorStop2 = vec3(1.0, 0.55, 0.0)   // #ff8c00 converted
// colorStop3 = vec3(0.27, 0.0, 0.0)   // #440000 converted
```

### Conversion Process

1. **Hex to RGB**: `#ff8c00` → `rgb(255, 140, 0)`
2. **Normalize**: `rgb(255, 140, 0)` → `vec3(1.0, 0.549, 0.0)`
3. **Apply to Uniform**: Set `colorStop2` uniform to `vec3(1.0, 0.549, 0.0)`

### Supported Color Formats

```javascript
// Hex formats
'#ff0000'; // Full hex
'#f00'; // Short hex

// RGB formats
'rgb(255, 0, 0)';
'rgba(255, 0, 0, 1.0)';

// Named colors (limited support)
('red', 'blue', 'white', 'black');
```

## Effect Presets

### Fire Explosion (Default)

**Visual**: Bright white core transitioning through orange to dark red
**Use Case**: Standard ship explosions, impact effects

```javascript
const fireExplosion = {
  // Shader parameters
  fadeInDuration: 0.1,
  fadeOutStart: 0.7,
  softEdgePower: 2.2,
  colorIntensity: 1.2,

  // Color progression
  colorOverride: ['#fffbda', '#ff8c00', '#440000'],

  // Particle system parameters
  countPerRadius: 18,
  lifetime: 1.2,
  size: { min: 0.02, max: 0.25 },
  velocity: { radial: { min: 40, max: 240 }, randomSpread: 0.6 },
};
```

### Electric Explosion

**Visual**: Pure white to cyan to blue, sharp transitions
**Use Case**: Energy weapons, shield failures, EMP effects

```javascript
const electricExplosion = {
  // Shader parameters
  fadeInDuration: 0.05, // Very quick fade-in
  fadeOutStart: 0.8, // Long visibility
  softEdgePower: 3.5, // Sharp edges
  colorIntensity: 1.5, // High intensity

  // Color progression
  colorOverride: ['#ffffff', '#00ffff', '#0044ff'],

  // Particle system parameters
  countPerRadius: 15,
  lifetime: 0.8, // Shorter lived
  size: { min: 0.01, max: 0.15 },
  velocity: { radial: { min: 80, max: 300 }, randomSpread: 0.8 },
};
```

### Plasma Explosion

**Visual**: Magenta to purple progression, ethereal glow
**Use Case**: Alien weapons, exotic matter, special effects

```javascript
const plasmaExplosion = {
  // Shader parameters
  fadeInDuration: 0.15,
  fadeOutStart: 0.6,
  softEdgePower: 1.8, // Softer edges
  colorIntensity: 1.8, // Very bright

  // Color progression
  colorOverride: ['#ff00ff', '#8000ff', '#1a0033'],

  // Particle system parameters
  countPerRadius: 25,
  lifetime: 1.5,
  size: { min: 0.03, max: 0.3 },
  velocity: { radial: { min: 30, max: 180 }, randomSpread: 0.4 },
};
```

### Toxic Gas Explosion

**Visual**: Bright green to dark green, smoky appearance
**Use Case**: Chemical weapons, environmental hazards

```javascript
const toxicExplosion = {
  // Shader parameters
  fadeInDuration: 0.2, // Slow formation
  fadeOutStart: 0.5, // Long lingering
  softEdgePower: 1.5, // Very soft edges
  colorIntensity: 1.0, // Natural intensity

  // Color progression
  colorOverride: ['#ccff00', '#00cc00', '#003311'],

  // Particle system parameters
  countPerRadius: 30, // Dense cloud
  lifetime: 2.5, // Long-lived
  size: { min: 0.05, max: 0.4 },
  velocity: { radial: { min: 15, max: 60 }, randomSpread: 0.3 },
};
```

### Smoke Explosion

**Visual**: Gray tones, soft and billowy
**Use Case**: Secondary explosions, debris clouds

```javascript
const smokeExplosion = {
  // Shader parameters
  fadeInDuration: 0.3,
  fadeOutStart: 0.4,
  softEdgePower: 1.2, // Very soft
  colorIntensity: 0.8, // Subdued

  // Color progression
  colorOverride: ['#bbbbbb', '#777777', '#111111'],

  // Particle system parameters
  countPerRadius: 35,
  lifetime: 3.0, // Very long-lived
  size: { min: 0.1, max: 0.6 },
  velocity: { radial: { min: 10, max: 40 }, randomSpread: 0.2 },
};
```

## Integration Examples

### Basic Usage

```typescript
import { addParticleExplosion } from '../renderer/particleSystem.js';

// Fire explosion on ship death
addParticleExplosion(gameState, {
  pos: ship.position,
  radius: ship.radius,
  colorOverride: ['#fffbda', '#ff8c00', '#440000'],
  lifetime: 1.2,
});
```

### Team-Based Colors

```typescript
// Configure team-specific explosion colors
const teamExplosionColors = {
  red: ['#fffbda', '#ff4444', '#440000'],
  blue: ['#fffbda', '#4444ff', '#000044'],
};

// Use appropriate colors based on ship team
addParticleExplosion(gameState, {
  pos: ship.position,
  radius: ship.radius,
  colorOverride: teamExplosionColors[ship.team],
  entityId: ship.id, // For deterministic seeding
});
```

### Size-Based Effects

```typescript
// Scale effect parameters based on ship size
function createScaledExplosion(ship: Ship) {
  const sizeMultiplier = ship.radius / 10; // Normalize to base size

  return {
    pos: ship.position,
    radius: ship.radius,
    colorOverride: getShipExplosionColors(ship.class),
    count: Math.floor(18 * sizeMultiplier), // More particles for larger ships
    lifetime: 1.2 + sizeMultiplier * 0.5, // Longer duration for larger ships
    entityId: ship.id,
  };
}
```

### Custom Shader Configuration

```typescript
// Configure shader parameters in renderer
const shaderParams = {
  fadeInDuration: 0.1,
  fadeOutStart: 0.7,
  billboardScale: 1.0,
  softEdgePower: 2.2,
  colorIntensity: 1.2,

  // Map colorOverride to shader uniforms
  colorStop1: hexToVec3(colorOverride[0]),
  colorStop2: hexToVec3(colorOverride[1]),
  colorStop3: hexToVec3(colorOverride[2]),

  colorStop1Pos: 0.0,
  colorStop2Pos: 0.4,
  colorStop3Pos: 1.0,
};

// Apply to shader material
explosionMaterial.uniforms = {
  ...explosionMaterial.uniforms,
  ...shaderParams,
};
```

## Performance Guidelines

### LOD (Level of Detail) Considerations

```javascript
// Distance-based parameter scaling
function getLODParameters(distanceToCamera: number) {
  if (distanceToCamera < 500) {
    // Close - full quality
    return {
      textureSize: 512,
      particleCount: 1.0,
      softEdgePower: 2.2
    };
  } else if (distanceToCamera < 1500) {
    // Medium - reduced quality
    return {
      textureSize: 256,
      particleCount: 0.6,
      softEdgePower: 1.8
    };
  } else {
    // Far - minimal quality
    return {
      textureSize: 256,
      particleCount: 0.3,
      softEdgePower: 1.5
    };
  }
}
```

### Mobile Optimizations

```javascript
const mobileOptimizedExplosion = {
  // Reduced shader complexity
  fadeInDuration: 0.1,
  fadeOutStart: 0.8,
  softEdgePower: 2.0, // Simpler calculation
  colorIntensity: 1.0,

  // Fewer particles
  countPerRadius: 12, // Reduced from 18
  maxCount: 100, // Reduced from 200

  // Smaller textures
  textureSize: 256, // Always use 256px on mobile

  // Shorter duration
  lifetime: 1.0, // Reduced from 1.2
};
```

### Batching Considerations

```javascript
// Group similar explosions for better performance
const explosionBatches = new Map();

function addBatchedExplosion(ship: Ship) {
  const batchKey = `${ship.class}-${ship.team}`;

  if (!explosionBatches.has(batchKey)) {
    explosionBatches.set(batchKey, []);
  }

  explosionBatches.get(batchKey).push({
    pos: ship.position,
    radius: ship.radius,
    entityId: ship.id
  });
}

// Process batches with shared parameters
function processBatchedExplosions() {
  for (const [batchKey, explosions] of explosionBatches) {
    const [shipClass, team] = batchKey.split('-');
    const sharedParams = getExplosionParams(shipClass, team);

    for (const explosion of explosions) {
      addParticleExplosion(gameState, {
        ...explosion,
        ...sharedParams
      });
    }
  }

  explosionBatches.clear();
}
```

## Testing Configuration

### Development Console Commands

```javascript
// Test different presets
window.testExplosion = (preset) => {
  const presets = {
    fire: ['#fffbda', '#ff8c00', '#440000'],
    electric: ['#ffffff', '#00ffff', '#0044ff'],
    plasma: ['#ff00ff', '#8000ff', '#1a0033'],
    toxic: ['#ccff00', '#00cc00', '#003311'],
    smoke: ['#bbbbbb', '#777777', '#111111'],
  };

  addParticleExplosion(gameState, {
    pos: { x: 0, y: 0, z: 0 },
    radius: 25,
    colorOverride: presets[preset] || presets.fire,
  });
};

// Usage: testExplosion('electric')
```

### Parameter Validation

```javascript
function validateShaderParams(params) {
  const warnings = [];

  if (params.fadeInDuration > 0.5) {
    warnings.push('fadeInDuration > 0.5 may cause delayed particle appearance');
  }

  if (params.fadeOutStart < 0.3) {
    warnings.push('fadeOutStart < 0.3 may cause particles to fade too quickly');
  }

  if (params.softEdgePower > 4.0) {
    warnings.push('softEdgePower > 4.0 may cause harsh edges on some hardware');
  }

  return warnings;
}
```

---

This parameter reference provides the foundation for creating custom explosion effects. Experiment with different combinations to achieve the desired visual style for your technical art needs.
