# Shader & Asset Authoring Guide for Technical Artists

This guide provides comprehensive documentation for technical artists creating explosion textures, particle effects, and custom shaders for SpaceAutoBattler.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Asset Guidelines](#asset-guidelines)
3. [Texture Specifications](#texture-specifications)
4. [Shader Reference](#shader-reference)
5. [Color Override System](#color-override-system)
6. [Testing Your Assets](#testing-your-assets)
7. [Examples](#examples)

## Quick Start

To get started with custom explosion effects:

1. Create textures following the [specifications](#texture-specifications) below
2. Use the reference [billboard shader](#billboard-shader-reference) as a template
3. Configure your colors using the [color override system](#color-override-system)
4. Test immediately in the [dev scene](#testing-your-assets)

## Asset Guidelines

### Directory Structure

```
assets/
├── textures/           # Explosion and particle textures
│   ├── explosions/    # Explosion-specific textures
│   └── particles/     # General particle textures
└── shaders/           # Custom shader implementations
    ├── particle/      # Particle system shaders
    └── examples/      # Example shader templates
```

### Naming Conventions

Follow these naming patterns for consistency:

**Textures:**

- `soft-circle-[size].png` - Soft-edged circular gradients
- `explosion-[type]-[size].png` - Explosion textures
- `noise-[type]-[size].png` - Noise textures for variety
- `palette-[name].png` - Color lookup textures

**Examples:**

- `soft-circle-512.png`
- `explosion-fire-256.png`
- `noise-perlin-512.png`
- `palette-fire.png`

## Texture Specifications

### Recommended Formats & Sizes

**Primary Formats:**

- **PNG**: Best for transparency and gradients (`*.png`)
- **KTX2**: Optimal for GPU compression when supported (`*.ktx2`)

**Recommended Sizes:**

- **256×256px**: Standard resolution, good performance
- **512×512px**: High quality, moderate performance impact
- **1024×1024px**: Maximum quality (use sparingly)

**Performance Guidelines:**

- Use 256px for most particle textures
- Use 512px for hero explosion effects
- Avoid 1024px unless absolutely necessary
- Always include alpha channel for proper blending

### Soft-Circle Texture Requirements

Soft-circle textures are the foundation of explosion effects:

**Technical Requirements:**

- Square aspect ratio (256×256 or 512×512)
- Radial gradient from center
- White core (`#FFFFFF`) fading to transparent black (`#00000000`)
- Smooth falloff using gamma-corrected gradients
- No hard edges or banding

**Falloff Curve:**

```glsl
// Recommended falloff function
float softCircle = 1.0 - smoothstep(0.0, 1.0, distance(uv - 0.5, vec2(0.0)) * 2.0);
softCircle = pow(softCircle, 2.2); // Gamma correction for smooth falloff
```

### Noise Textures

For explosion variety and organic feel:

**Types:**

- **Perlin Noise**: Smooth, cloud-like patterns
- **Simplex Noise**: Higher frequency detail
- **Fractal Noise**: Multi-octave complexity

**Guidelines:**

- Use R channel for primary noise
- G channel for secondary detail
- B channel for variation/turbulence
- A channel for masking if needed

## Shader Reference

### Billboard Shader Reference

Here's the reference additive billboard shader for particle explosions:

```glsl
// Vertex Shader
attribute vec3 position;
attribute vec2 uv;
attribute vec3 instancePosition;
attribute float instanceSize;
attribute vec4 instanceColor;
attribute float instanceAge;
attribute float instanceLifetime;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

varying vec2 vUv;
varying vec4 vColor;
varying float vLifeRatio;

void main() {
  vUv = uv;
  vColor = instanceColor;
  vLifeRatio = clamp(instanceAge / instanceLifetime, 0.0, 1.0);

  // Billboard calculation - always face camera
  vec3 worldPosition = instancePosition;
  vec3 toBillboard = normalize(cameraPosition - worldPosition);
  vec3 right = normalize(cross(toBillboard, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, toBillboard);

  // Scale by instance size and apply position offset
  vec3 localPosition = right * position.x * instanceSize + up * position.y * instanceSize;
  vec4 worldPos = vec4(worldPosition + localPosition, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
```

```glsl
// Fragment Shader
uniform sampler2D explosionTexture;
uniform float fadeInDuration;
uniform float fadeOutStart;
uniform vec3 colorStops[3];
uniform float colorStopPositions[3];

varying vec2 vUv;
varying vec4 vColor;
varying float vLifeRatio;

vec3 interpolateColor(float t) {
  // Interpolate between color stops based on lifetime
  if (t <= colorStopPositions[0]) {
    return colorStops[0];
  } else if (t <= colorStopPositions[1]) {
    float factor = (t - colorStopPositions[0]) / (colorStopPositions[1] - colorStopPositions[0]);
    return mix(colorStops[0], colorStops[1], factor);
  } else {
    float factor = (t - colorStopPositions[1]) / (colorStopPositions[2] - colorStopPositions[1]);
    return mix(colorStops[1], colorStops[2], factor);
  }
}

void main() {
  // Sample the soft-circle texture
  vec4 texColor = texture2D(explosionTexture, vUv);

  // Calculate color based on lifetime
  vec3 dynamicColor = interpolateColor(vLifeRatio);

  // Apply color override if provided, otherwise use dynamic color
  vec3 finalColor = vColor.rgb * dynamicColor;

  // Calculate alpha fade
  float fadeIn = smoothstep(0.0, fadeInDuration, vLifeRatio);
  float fadeOut = 1.0 - smoothstep(fadeOutStart, 1.0, vLifeRatio);
  float alpha = texColor.a * vColor.a * fadeIn * fadeOut;

  // Apply soft-edge falloff from texture
  alpha *= texColor.r; // Use red channel as luminance mask

  gl_FragColor = vec4(finalColor, alpha);
}
```

### Shader Parameters

**Configurable Parameters:**

| Parameter            | Type        | Description                                | Default               |
| -------------------- | ----------- | ------------------------------------------ | --------------------- |
| `explosionTexture`   | `sampler2D` | Soft-circle or explosion texture           | `soft-circle-512.png` |
| `fadeInDuration`     | `float`     | How quickly particles fade in (0.0-1.0)    | `0.1`                 |
| `fadeOutStart`       | `float`     | When fade-out begins (0.0-1.0)             | `0.7`                 |
| `colorStops`         | `vec3[3]`   | RGB color stops for lifetime interpolation | See below             |
| `colorStopPositions` | `float[3]`  | Positions of color stops (0.0-1.0)         | `[0.0, 0.5, 1.0]`     |

**Default Color Stops:**

```javascript
colorStops: [
  vec3(1.0, 0.98, 0.85), // Bright white-yellow (birth)
  vec3(1.0, 0.55, 0.0), // Orange (mid-life)
  vec3(0.27, 0.0, 0.0), // Dark red (death)
];
```

## Color Override System

The `colorOverride` parameter allows dynamic color customization without shader recompilation.

### How It Works

1. **Configuration**: Set colors in `rendererConfig.particles.explosion.colors`
2. **Override**: Pass `colorOverride` array in `ParticleExplosionOptions`
3. **Application**: Shader receives colors via instance attributes
4. **Interpolation**: Colors interpolate over particle lifetime

### Usage Examples

**Basic Usage:**

```typescript
// Use default colors from config
addParticleExplosion(state, {
  pos: { x: 100, y: 50, z: 0 },
  radius: 25,
});

// Override with custom colors
addParticleExplosion(state, {
  pos: { x: 100, y: 50, z: 0 },
  radius: 25,
  colorOverride: ['#ffffff', '#00ff00', '#004400'], // White to green explosion
});
```

**Team-Based Colors:**

```typescript
// Red team explosion
const redExplosion = ['#fffbda', '#ff4444', '#440000'];

// Blue team explosion
const blueExplosion = ['#fffbda', '#4444ff', '#000044'];

addParticleExplosion(state, {
  pos: ship.position,
  radius: ship.radius,
  colorOverride: ship.team === 'red' ? redExplosion : blueExplosion,
});
```

### Color Format

**Supported Formats:**

- Hex strings: `'#ff0000'`, `'#f00'`
- RGB strings: `'rgb(255, 0, 0)'`
- Named colors: `'red'`, `'blue'`, `'white'`

**Conversion to Shader:**
The system automatically converts color strings to `vec3` uniforms:

```javascript
'#ff8c00' → vec3(1.0, 0.549, 0.0)
```

## Testing Your Assets

### Development Scene

The game includes a development scene for immediate asset testing:

1. **Start Development Server:**

   ```bash
   npm run build:dev
   npm run serve
   ```

2. **Access Test Scene:**
   Navigate to `http://localhost:8080/dist/index.html?dev=1`

3. **Trigger Explosions:**
   - Press `E` to spawn test explosions
   - Press `T` to cycle through color themes
   - Press `R` to reload textures without restart

### Asset Hot-Reload

The dev scene supports hot-reloading of assets:

1. Place textures in `assets/textures/`
2. Modify files and save
3. Press `R` in the dev scene to reload
4. Changes appear immediately

### Debug Options

Enable debug visualization:

```javascript
// In browser console
window.debugParticles = true; // Show particle bounds
window.debugShaders = true; // Show shader compilation logs
window.debugColors = true; // Show color interpolation
```

## Examples

### Example 1: Fire Explosion

**Texture:** `soft-circle-512.png` with warm gradient
**Colors:** `['#fffbda', '#ff8c00', '#440000']`
**Parameters:**

```javascript
{
  countPerRadius: 20,
  lifetime: 1.2,
  size: { min: 0.02, max: 0.25 },
  velocity: { radial: { min: 40, max: 240 }, randomSpread: 0.6 }
}
```

### Example 2: Electric Explosion

**Texture:** `soft-circle-256.png` with sharp edges
**Colors:** `['#ffffff', '#00ffff', '#0044ff']`
**Parameters:**

```javascript
{
  countPerRadius: 15,
  lifetime: 0.8,
  size: { min: 0.01, max: 0.15 },
  velocity: { radial: { min: 80, max: 300 }, randomSpread: 0.8 }
}
```

### Example 3: Smoke Explosion

**Texture:** `noise-perlin-512.png` for organic feel
**Colors:** `['#888888', '#444444', '#111111']`
**Parameters:**

```javascript
{
  countPerRadius: 30,
  lifetime: 2.0,
  size: { min: 0.05, max: 0.4 },
  velocity: { radial: { min: 20, max: 80 }, randomSpread: 0.4 }
}
```

## Performance Considerations

### Optimization Guidelines

1. **Texture Memory:**
   - Prefer 256×256 for most cases
   - Use texture atlases for multiple small textures
   - Consider KTX2 compression for mobile

2. **Particle Count:**
   - Default `countPerRadius: 18` is well-optimized
   - Reduce for mobile: `countPerRadius: 12`
   - Maximum recommended: `maxCount: 200`

3. **Shader Complexity:**
   - Keep fragment shader lightweight
   - Avoid complex branching in shaders
   - Pre-calculate values in vertex shader when possible

4. **GPU Memory:**
   - Reuse materials and geometries
   - Dispose unused textures properly
   - Monitor memory usage in dev tools

### Performance Testing

Test your effects under load:

```javascript
// Spawn multiple explosions for stress testing
for (let i = 0; i < 10; i++) {
  addParticleExplosion(state, {
    pos: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100, z: 0 },
    radius: 25,
    colorOverride: yourCustomColors,
  });
}
```

## Troubleshooting

### Common Issues

**Textures Not Loading:**

- Check file paths and naming conventions
- Verify texture dimensions are power-of-2
- Ensure proper file permissions

**Colors Not Appearing:**

- Verify hex color format (`#rrggbb`)
- Check alpha channel in texture
- Confirm additive blending is enabled

**Performance Issues:**

- Reduce particle count or texture resolution
- Check GPU memory usage
- Profile with browser dev tools

### Debug Commands

```javascript
// In browser console
particleSystem.stats(); // Show pool statistics
renderer.debugShader('particle'); // Show shader compilation
texture.checkFormat('explosion'); // Validate texture format
```

## Integration Notes

### Existing Systems

This shader system integrates with:

- **Particle System**: `src/renderer/particleSystem.ts`
- **Renderer Config**: `src/config/rendererConfig.ts`
- **Asset Pool**: `src/core/assetPool.ts`
- **Game State**: Canonical state management

### API Compatibility

The shader system maintains backward compatibility with:

- Existing `addParticleExplosion()` API
- Configuration in `rendererConfig.particles.explosion`
- Color override system via `ParticleExplosionOptions`

---

## Next Steps

1. Create your first soft-circle texture
2. Test with the reference shader
3. Experiment with custom color schemes
4. Optimize for your target performance
5. Share your assets with the team!

For questions or advanced techniques, consult the [particle system specification](particle-explosion-spec.md).
