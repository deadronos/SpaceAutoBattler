# Example Texture Specifications

This document provides specific examples and templates for creating explosion textures for SpaceAutoBattler.

## Soft-Circle Texture Examples

### Standard Soft-Circle (512×512)

**File**: `soft-circle-512.png`
**Specifications**:
- **Size**: 512×512 pixels
- **Format**: PNG with alpha channel
- **Colors**: White (#FFFFFF) to transparent black (#00000000)
- **Gradient**: Radial from center, gamma-corrected (power 2.2)
- **Edge**: Smooth falloff, no hard transitions

**Photoshop/GIMP Creation Steps**:
1. Create new 512×512 document with transparent background
2. Select Radial Gradient tool
3. Set foreground to white (#FFFFFF), background to transparent
4. Create gradient from center to edge
5. Apply Gaussian blur (radius: 2-4px) for smooth edges
6. Adjust levels: Gamma 0.45 (equivalent to power 2.2 correction)
7. Save as PNG with transparency

**CSS Background Equivalent** (for reference):
```css
background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%);
```

### Performance Soft-Circle (256×256)

**File**: `soft-circle-256.png`
**Same specifications as 512×512 but at 256×256 resolution**
- Use for mobile or when many particles are on screen
- Maintains visual quality while reducing memory usage by 75%

### High-Quality Soft-Circle (1024×1024)

**File**: `soft-circle-1024.png`
**Same specifications as 512×512 but at 1024×1024 resolution**
- Use sparingly for hero effects only
- 4x memory usage - ensure adequate GPU memory

## Noise Texture Examples

### Perlin Noise Texture (512×512)

**File**: `noise-perlin-512.png`
**Specifications**:
- **Size**: 512×512 pixels
- **Format**: PNG, RGB channels used
- **Red Channel**: Primary noise (0-255)
- **Green Channel**: Secondary detail noise (0-255)
- **Blue Channel**: Turbulence/variation (0-255)
- **Alpha Channel**: Optional masking (255 for full coverage)

**Generation Parameters**:
- **Frequency**: 0.02 (low frequency for large features)
- **Octaves**: 4 (multi-scale detail)
- **Persistence**: 0.5 (how much each octave contributes)
- **Lacunarity**: 2.0 (frequency multiplier between octaves)

**Usage**: Multiply with soft-circle for organic explosion shapes

### Fractal Noise Texture (512×512)

**File**: `noise-fractal-512.png`
**More complex noise for detailed explosions**
- Higher octave count (6-8)
- Lower persistence (0.3-0.4) for sharp details
- Higher lacunarity (2.5-3.0) for fine structure

## Color Palette Examples

### Fire Palette Texture (16×1)

**File**: `palette-fire.png`
**Specifications**:
- **Size**: 16×1 pixels (horizontal strip)
- **Format**: PNG, RGB
- **Usage**: Lookup texture for color progression

**Color Stops** (left to right):
```
Pixel 0:  #FFFBDA (bright white-yellow)
Pixel 4:  #FFD700 (gold)
Pixel 8:  #FF8C00 (orange)
Pixel 12: #FF4500 (red-orange)  
Pixel 15: #440000 (dark red)
```

**Shader Usage**:
```glsl
vec3 fireColor = texture2D(firePalette, vec2(lifeRatio, 0.5)).rgb;
```

### Electric Palette Texture (16×1)

**File**: `palette-electric.png`
**Color Stops**:
```
Pixel 0:  #FFFFFF (pure white)
Pixel 4:  #E0FFFF (light cyan)
Pixel 8:  #00FFFF (cyan)
Pixel 12: #0088FF (blue)
Pixel 15: #0044FF (dark blue)
```

## Texture Creation Templates

### Photoshop Action (Soft-Circle)

```
Action: "Create Soft Circle"
1. New Document (512x512, Transparent)
2. Select Elliptical Marquee (centered, 490x490)
3. Feather Selection (50 pixels)
4. Fill with White
5. Deselect
6. Filter > Blur > Gaussian Blur (2px)
7. Image > Adjustments > Levels (Gamma: 0.45)
8. Save as PNG
```

### GIMP Script-Fu (Soft-Circle)

```scheme
(define (create-soft-circle size filename)
  (let* ((img (car (gimp-image-new size size RGB)))
         (layer (car (gimp-layer-new img size size RGBA-IMAGE "Soft Circle" 100 NORMAL-MODE))))
    
    (gimp-image-add-layer img layer 0)
    (gimp-context-set-foreground '(255 255 255))
    (gimp-context-set-background '(0 0 0))
    
    ; Create radial gradient
    (gimp-edit-blend layer FG-BG-RGB-MODE NORMAL-MODE 
                     GRADIENT-RADIAL 100 0 REPEAT-NONE FALSE 
                     FALSE 0 0 TRUE 
                     (/ size 2) (/ size 2)    ; center
                     (* size 0.45) (* size 0.45))  ; radius
    
    ; Add transparency
    (gimp-layer-add-alpha layer)
    
    ; Apply gamma correction
    (gimp-levels layer HISTOGRAM-VALUE 0 255 0.45 0 255)
    
    ; Export
    (file-png-save RUN-NONINTERACTIVE img layer filename filename
                   0 9 0 0 0 0 0)
    
    (gimp-image-delete img)))

; Usage: (create-soft-circle 512 "soft-circle-512.png")
```

### Blender Shader Nodes (Procedural)

```
Nodes for procedural soft-circle texture:
1. Texture Coordinate -> Generated
2. Mapping -> Location (0,0,0), Scale (2,2,2)
3. ColorRamp -> Constant, Black to White
4. Math -> Distance, UV to (0.5, 0.5)
5. Math -> Power, Distance result ^ 2.2
6. Math -> Subtract, 1.0 - Power result  
7. ColorRamp -> Linear, adjust stops
8. Output to Alpha of Principled BSDF
```

## Asset Organization

### Directory Structure

```
assets/textures/
├── explosions/
│   ├── soft-circle-256.png
│   ├── soft-circle-512.png
│   ├── soft-circle-1024.png
│   ├── noise-perlin-512.png
│   ├── noise-fractal-512.png
│   └── noise-turbulence-256.png
├── palettes/
│   ├── palette-fire.png
│   ├── palette-electric.png
│   ├── palette-plasma.png
│   └── palette-toxic.png
└── examples/
    ├── explosion-fire-example.png
    ├── explosion-electric-example.png
    └── README.md
```

### Naming Convention

**Format**: `[type]-[variant]-[size].[ext]`

**Examples**:
```
soft-circle-standard-512.png    # Standard soft circle, 512px
soft-circle-sharp-256.png       # Sharp-edged variant, 256px
noise-perlin-organic-512.png    # Perlin noise, organic variant
palette-fire-warm-16x1.png      # Fire palette, warm colors, 16x1
```

**Variants**:
- `standard` - Default parameters
- `sharp` - Higher contrast, defined edges  
- `soft` - Lower contrast, blurry edges
- `organic` - Natural, irregular patterns
- `geometric` - Clean, mathematical patterns

## Quality Assurance Checklist

### Technical Validation

- [ ] **Power-of-2 dimensions** (256, 512, 1024)
- [ ] **PNG format with alpha** for transparency
- [ ] **No compression artifacts** in gradients
- [ ] **Smooth falloff** with no banding
- [ ] **Centered gradient** (pixel-perfect center)
- [ ] **Proper gamma correction** (linear workflow)

### Visual Validation

- [ ] **Smooth edges** when scaled
- [ ] **No hard cutoffs** at texture edges
- [ ] **Appropriate brightness** for additive blending
- [ ] **Consistent style** with game art direction
- [ ] **Readable at distance** (LOD considerations)

### Performance Validation

- [ ] **Appropriate resolution** for use case
- [ ] **Minimal file size** (optimized PNG)
- [ ] **Tileable if needed** for repeated patterns
- [ ] **GPU memory usage** within budget
- [ ] **Loading time** acceptable for real-time use

## Integration Testing

### Browser Console Commands

```javascript
// Load and test custom textures
async function testCustomTexture(url) {
  const texture = await textureLoader.loadAsync(url);
  
  // Apply to test explosion
  addParticleExplosion(gameState, {
    pos: { x: 0, y: 0, z: 0 },
    radius: 25,
    customTexture: texture
  });
  
  console.log(`Loaded texture: ${texture.image.width}x${texture.image.height}`);
}

// Usage
testCustomTexture('assets/textures/explosions/soft-circle-512.png');
```

### Shader Debugging

```javascript
// Validate texture properties
function validateExplosionTexture(texture) {
  const issues = [];
  
  if (!isPowerOfTwo(texture.image.width)) {
    issues.push('Width is not power of 2');
  }
  
  if (texture.image.width !== texture.image.height) {
    issues.push('Texture is not square');
  }
  
  if (!texture.format === THREE.RGBAFormat) {
    issues.push('Missing alpha channel');
  }
  
  return issues;
}

function isPowerOfTwo(value) {
  return (value & (value - 1)) === 0;
}
```

---

These specifications provide concrete examples for creating high-quality explosion textures. Use them as templates for consistent asset creation across the project.