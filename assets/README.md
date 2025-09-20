# SpaceAutoBattler Asset Library

This directory contains shader and texture assets for technical artists working on explosion effects and particle systems.

## Quick Start

1. **Read the Guide**: Start with [`../spec/shader-authoring-guide.md`](../spec/shader-authoring-guide.md)
2. **Check Examples**: Review texture specifications in [`textures/texture-specifications.md`](textures/texture-specifications.md)
3. **Use Tools**: Leverage utilities in [`shaders/`](shaders/) directory
4. **Test Assets**: Use the explosion tester for immediate feedback

## Directory Structure

```
assets/
├── textures/                    # Explosion and particle textures
│   ├── texture-specifications.md   # Detailed texture creation guide
│   └── [generated textures]       # Runtime generated assets
├── shaders/                     # Shader implementations and utilities
│   ├── billboardExplosionShader.ts    # Reference shader implementation
│   ├── softCircleGenerator.ts         # Procedural texture generator
│   ├── explosionTester.ts             # Development testing utility
│   └── shader-parameters.md           # Parameter reference guide
└── README.md                    # This file
```

## Key Files

### For Technical Artists

- **[`../spec/shader-authoring-guide.md`](../spec/shader-authoring-guide.md)** - Complete authoring guide
- **[`textures/texture-specifications.md`](textures/texture-specifications.md)** - Texture creation examples
- **[`shaders/shader-parameters.md`](shaders/shader-parameters.md)** - Parameter reference

### For Developers

- **[`shaders/billboardExplosionShader.ts`](shaders/billboardExplosionShader.ts)** - Reference shader implementation
- **[`shaders/softCircleGenerator.ts`](shaders/softCircleGenerator.ts)** - Procedural texture utility
- **[`shaders/explosionTester.ts`](shaders/explosionTester.ts)** - Development testing tools

## Quick Reference

### Recommended Texture Sizes

- **256×256px** - Performance/mobile
- **512×512px** - Standard quality
- **1024×1024px** - High quality (use sparingly)

### Supported Formats

- **PNG** - Primary format, supports alpha
- **KTX2** - Compressed format for production (when available)

### Color Override System

```javascript
// Basic usage
addParticleExplosion(gameState, {
  pos: { x: 0, y: 0, z: 0 },
  radius: 25,
  colorOverride: ['#ffffff', '#ff8c00', '#440000'], // White → Orange → Red
});
```

### Development Testing

```javascript
// Browser console
window.testExplosion = (preset) => {
  const presets = {
    fire: ['#fffbda', '#ff8c00', '#440000'],
    electric: ['#ffffff', '#00ffff', '#0044ff'],
    plasma: ['#ff00ff', '#8000ff', '#1a0033'],
  };

  addParticleExplosion(gameState, {
    pos: { x: 0, y: 0, z: 0 },
    radius: 25,
    colorOverride: presets[preset],
  });
};
```

## Integration with SpaceAutoBattler

### Current Integration

These assets integrate with the existing particle system:

- **Particle System**: `src/renderer/particleSystem.ts`
- **Configuration**: `src/config/rendererConfig.ts`
- **Shader Location**: `src/renderer/shaders/`
- **Asset Pool**: `src/core/assetPool.ts`

### colorOverride Mapping

The colorOverride system works as follows:

1. **Input**: Array of hex color strings in `ParticleExplosionOptions`
2. **Processing**: Automatic conversion to `vec3` shader uniforms
3. **Shader**: Color interpolation over particle lifetime
4. **Result**: Dynamic explosion colors without shader recompilation

### Performance Considerations

- **Texture Memory**: 512×512 RGBA = ~1MB, plan accordingly
- **Particle Count**: Default 18 per radius unit is well-optimized
- **LOD System**: Automatic distance-based quality reduction available
- **Pooling**: Efficient particle instance recycling built-in

## Usage Examples

### Fire Explosion

```javascript
addParticleExplosion(gameState, {
  pos: ship.position,
  radius: ship.radius,
  colorOverride: ['#fffbda', '#ff8c00', '#440000'],
  lifetime: 1.2,
  count: 18,
});
```

### Team-Based Colors

```javascript
const teamColors = {
  red: ['#fffbda', '#ff4444', '#440000'],
  blue: ['#fffbda', '#4444ff', '#000044'],
};

addParticleExplosion(gameState, {
  pos: ship.position,
  radius: ship.radius,
  colorOverride: teamColors[ship.team],
  entityId: ship.id, // For deterministic seeding
});
```

## Development Workflow

### For Artists

1. **Create Textures**: Follow specifications in `texture-specifications.md`
2. **Test Visually**: Use explosion tester (`F1` key in dev mode)
3. **Iterate**: Adjust parameters and reload textures (`R` key)
4. **Export**: Save final configurations for production

### For Developers

1. **Implement Shaders**: Use `billboardExplosionShader.ts` as reference
2. **Add Parameters**: Extend configuration system as needed
3. **Test Performance**: Monitor particle counts and frame rates
4. **Integrate**: Connect with existing asset pipeline

## Troubleshooting

### Common Issues

**Textures not loading:**

- Check file paths and naming conventions
- Verify texture dimensions are power-of-2
- Ensure PNG has alpha channel

**Colors not appearing:**

- Verify hex color format (`#rrggbb`)
- Check that additive blending is enabled
- Confirm shader uniform mapping

**Performance issues:**

- Reduce particle count or texture resolution
- Check GPU memory usage in dev tools
- Consider LOD system for distant explosions

### Debug Commands

```javascript
// Browser console utilities
particleSystem.stats(); // Show pool statistics
softCircleUtils.showPresets(); // Generate test textures
window.ExplosionTester(gameState); // Create test interface
```

## Contributing

### Adding New Effects

1. Create shader variant in `shaders/` directory
2. Add preset in `shader-parameters.md`
3. Include example in authoring guide
4. Test with explosion tester utility

### Texture Guidelines

- Use consistent naming: `[type]-[variant]-[size].[ext]`
- Include power-of-2 versions: 256, 512, 1024
- Provide usage documentation
- Test on various hardware configurations

---

For detailed documentation, see the [Shader Authoring Guide](../spec/shader-authoring-guide.md) and related specifications.
