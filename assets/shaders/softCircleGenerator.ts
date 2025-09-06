/**
 * Soft-Circle Texture Generator
 * 
 * Utility for procedurally generating soft-circle textures for explosion effects.
 * Can be used in development/testing or as reference for artists creating textures manually.
 * 
 * Features:
 * - Gamma-corrected radial gradients
 * - Configurable falloff curves
 * - Multiple export formats (Canvas, ImageData, PNG blob)
 * - Power-of-2 dimensions for optimal GPU performance
 */

export interface SoftCircleOptions {
  size: number;                    // Texture size (should be power of 2: 256, 512, 1024)
  falloffPower: number;           // Gamma correction for falloff curve (2.2 recommended)
  coreRadius: number;             // Inner solid core (0.0-1.0, 0.0 = no core)
  edgeSoftness: number;           // How soft the edge transition is (0.1-1.0)
  brightness: number;             // Overall brightness multiplier (0.0-2.0)
  contrast: number;               // Contrast adjustment (0.5-2.0, 1.0 = no change)
}

export const DefaultSoftCircleOptions: SoftCircleOptions = {
  size: 512,
  falloffPower: 2.2,              // Gamma-corrected falloff  
  coreRadius: 0.0,                // No solid core - smooth from center
  edgeSoftness: 0.8,              // Soft edge transition
  brightness: 1.0,                // Standard brightness
  contrast: 1.0,                  // No contrast adjustment
};

/**
 * Generate a soft-circle texture using HTML5 Canvas
 * Returns a canvas element that can be used as a texture source
 */
export function generateSoftCircleCanvas(options: Partial<SoftCircleOptions> = {}): HTMLCanvasElement {
  const opts = { ...DefaultSoftCircleOptions, ...options };
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = opts.size;
  canvas.height = opts.size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Create ImageData for pixel manipulation
  const imageData = ctx.createImageData(opts.size, opts.size);
  const data = imageData.data;
  
  const center = opts.size / 2;
  const maxRadius = center;
  
  // Generate pixels
  for (let y = 0; y < opts.size; y++) {
    for (let x = 0; x < opts.size; x++) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const normalizedDistance = distance / maxRadius;
      
      // Calculate alpha based on distance with configurable falloff
      let alpha = calculateSoftCircleAlpha(normalizedDistance, opts);
      
      // Apply brightness and contrast
      alpha = applyBrightnessContrast(alpha, opts.brightness, opts.contrast);
      
      // Clamp to valid range
      alpha = Math.max(0, Math.min(1, alpha));
      
      const pixelIndex = (y * opts.size + x) * 4;
      
      // Set RGB to white (texture provides luminance mask)
      data[pixelIndex] = 255;     // R
      data[pixelIndex + 1] = 255; // G  
      data[pixelIndex + 2] = 255; // B
      data[pixelIndex + 3] = Math.floor(alpha * 255); // A
    }
  }
  
  // Apply ImageData to canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}

/**
 * Calculate alpha value for soft-circle based on normalized distance
 */
function calculateSoftCircleAlpha(normalizedDistance: number, options: SoftCircleOptions): number {
  const { coreRadius, edgeSoftness, falloffPower } = options;
  
  if (normalizedDistance <= coreRadius) {
    // Inside core radius - full opacity
    return 1.0;
  }
  
  if (normalizedDistance >= 1.0) {
    // Outside circle - transparent
    return 0.0;
  }
  
  // Calculate falloff between core and edge
  const falloffStart = coreRadius;
  const falloffEnd = Math.min(1.0, coreRadius + edgeSoftness);
  
  if (normalizedDistance >= falloffEnd) {
    return 0.0;
  }
  
  // Linear interpolation in falloff region
  const falloffProgress = (normalizedDistance - falloffStart) / (falloffEnd - falloffStart);
  
  // Apply gamma correction for smooth visual falloff
  const linearAlpha = 1.0 - falloffProgress;
  return Math.pow(linearAlpha, falloffPower);
}

/**
 * Apply brightness and contrast adjustments
 */
function applyBrightnessContrast(value: number, brightness: number, contrast: number): number {
  // Apply brightness (additive)
  let result = value * brightness;
  
  // Apply contrast (around midpoint 0.5)  
  result = (result - 0.5) * contrast + 0.5;
  
  return result;
}

/**
 * Generate soft-circle texture as PNG blob
 * Useful for saving textures to files
 */
export async function generateSoftCirclePNG(options: Partial<SoftCircleOptions> = {}): Promise<Blob> {
  const canvas = generateSoftCircleCanvas(options);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate PNG blob'));
      }
    }, 'image/png');
  });
}

/**
 * Generate soft-circle texture as WebGL-compatible texture
 * Returns a texture that can be used directly with Three.js
 */
export function generateSoftCircleTexture(renderer: any, options: Partial<SoftCircleOptions> = {}): any {
  const canvas = generateSoftCircleCanvas(options);
  
  // This would integrate with Three.js texture creation
  // Exact implementation depends on renderer architecture
  const texture = new (window as any).THREE.CanvasTexture(canvas);
  texture.format = (window as any).THREE.RGBAFormat;
  texture.generateMipmaps = true;
  texture.wrapS = (window as any).THREE.ClampToEdgeWrapping;
  texture.wrapT = (window as any).THREE.ClampToEdgeWrapping;
  
  return texture;
}

/**
 * Preset configurations for different explosion types
 */
export const SoftCirclePresets = {
  // Standard explosion - smooth falloff, good for most cases
  standard: {
    size: 512,
    falloffPower: 2.2,
    coreRadius: 0.0,
    edgeSoftness: 0.8,
    brightness: 1.0,
    contrast: 1.0,
  },
  
  // Sharp explosion - harder edge, more defined
  sharp: {
    size: 512, 
    falloffPower: 3.5,
    coreRadius: 0.1,
    edgeSoftness: 0.4,
    brightness: 1.2,
    contrast: 1.3,
  },
  
  // Soft explosion - very gradual falloff, smoky
  soft: {
    size: 512,
    falloffPower: 1.8,
    coreRadius: 0.0,
    edgeSoftness: 1.0,
    brightness: 0.9,
    contrast: 0.8,
  },
  
  // Small/performance - lower resolution for mobile
  performance: {
    size: 256,
    falloffPower: 2.2,
    coreRadius: 0.0,
    edgeSoftness: 0.7,
    brightness: 1.0,
    contrast: 1.0,
  },
  
  // High quality - maximum resolution
  highQuality: {
    size: 1024,
    falloffPower: 2.2,
    coreRadius: 0.0,
    edgeSoftness: 0.9,
    brightness: 1.0,
    contrast: 1.0,
  },
};

/**
 * Development utility: Generate and download texture files
 * Useful for artists who want to generate reference textures
 */
export async function downloadSoftCircleTexture(
  filename: string, 
  preset: keyof typeof SoftCirclePresets = 'standard'
): Promise<void> {
  const options = SoftCirclePresets[preset];
  const blob = await generateSoftCirclePNG(options);
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Development testing function
 * Generates all presets and provides visual comparison
 */
export function generateAllPresets(): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 20px; padding: 20px;';
  
  for (const [name, options] of Object.entries(SoftCirclePresets)) {
    const canvas = generateSoftCircleCanvas(options);
    canvas.style.cssText = `
      border: 1px solid #ccc; 
      background: black; 
      width: 128px; 
      height: 128px; 
      image-rendering: pixelated;
    `;
    
    const label = document.createElement('div');
    label.textContent = `${name} (${options.size}px)`;
    label.style.cssText = 'text-align: center; font-family: monospace; margin-top: 5px;';
    
    const wrapper = document.createElement('div');
    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    
    container.appendChild(wrapper);
  }
  
  return container;
}

/**
 * Browser console utilities for development
 * Usage: window.softCircleUtils = createSoftCircleUtils();
 */
export function createSoftCircleUtils() {
  return {
    // Generate and show all presets
    showPresets: () => {
      const presets = generateAllPresets();
      document.body.appendChild(presets);
      return presets;
    },
    
    // Download a specific preset
    download: (filename: string, preset: keyof typeof SoftCirclePresets = 'standard') => {
      downloadSoftCircleTexture(filename, preset);
    },
    
    // Generate custom texture with options
    generateCustom: (options: Partial<SoftCircleOptions>) => {
      return generateSoftCircleCanvas(options);
    },
    
    // List available presets
    presets: Object.keys(SoftCirclePresets),
    
    // Generate texture data for shader testing
    testData: (preset: keyof typeof SoftCirclePresets = 'standard') => {
      const canvas = generateSoftCircleCanvas(SoftCirclePresets[preset]);
      const ctx = canvas.getContext('2d');
      return ctx?.getImageData(0, 0, canvas.width, canvas.height);
    }
  };
}

// Export for development console access
if (typeof window !== 'undefined') {
  (window as any).softCircleUtils = createSoftCircleUtils();
}