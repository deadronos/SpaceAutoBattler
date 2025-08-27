/**
 * SVG Rasterization Worker
 * 
 * Uses OffscreenCanvas to rasterize SVG strings to ImageBitmap in the background,
 * freeing the main thread for rendering and user interaction.
 */

export interface RasterRequest {
  type: 'raster';
  id: string;
  svgText: string;
  width: number;
  height: number;
  teamColor?: string;
  options?: {
    backgroundColor?: string;
    scale?: number;
  };
}

export interface RasterResponse {
  type: 'raster:done' | 'raster:error';
  id: string;
  bitmap?: ImageBitmap;
  error?: string;
}

// Worker message handler
self.onmessage = async (event: MessageEvent<RasterRequest>) => {
  const { type, id, svgText, width, height, teamColor, options } = event.data;
  
  if (type !== 'raster') {
    self.postMessage({
      type: 'raster:error',
      id,
      error: 'Unknown message type'
    } as RasterResponse);
    return;
  }

  try {
    const bitmap = await rasterizeSvgToBitmap(svgText, width, height, teamColor, options);
    
    self.postMessage({
      type: 'raster:done',
      id,
      bitmap
    } as RasterResponse, { transfer: [bitmap] });
    
  } catch (error) {
    self.postMessage({
      type: 'raster:error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as RasterResponse);
  }
};

/**
 * Rasterize SVG text to ImageBitmap using OffscreenCanvas
 */
async function rasterizeSvgToBitmap(
  svgText: string,
  width: number,
  height: number,
  teamColor?: string,
  options?: {
    backgroundColor?: string;
    scale?: number;
  }
): Promise<ImageBitmap> {
  // Check OffscreenCanvas support
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas not supported in this environment');
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context from OffscreenCanvas');
  }

  // Clear canvas with background color
  ctx.clearRect(0, 0, width, height);
  if (options?.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Apply team color tinting if specified
  let processedSvg = svgText;
  if (teamColor) {
    processedSvg = applySvgTeamColorTinting(svgText, teamColor);
  }

  // Create blob URL for SVG
  const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    // Create image and wait for load
    const img = await loadImageFromUrl(svgUrl);
    
    // Apply scaling if specified
    const scale = options?.scale || 1;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    
    // Center the image
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    
    // Draw SVG to canvas
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    
    // Convert to ImageBitmap for efficient transfer
    const bitmap = canvas.transferToImageBitmap();
    return bitmap;
    
  } finally {
    // Clean up blob URL
    URL.revokeObjectURL(svgUrl);
  }
}

/**
 * Apply team color tinting to SVG by replacing hull/accent groups
 */
function applySvgTeamColorTinting(svgText: string, teamColor: string): string {
  // Replace fill attributes within hull and accent groups
  return svgText
    .replace(/<g[^>]*id="hull"[^>]*>([\s\S]*?)<\/g>/g, (match, content) => {
      const updatedContent = content.replace(/fill="[^"]*"/g, `fill="${teamColor}"`);
      return match.replace(content, updatedContent);
    })
    .replace(/<g[^>]*id="accent"[^>]*>([\s\S]*?)<\/g>/g, (match, content) => {
      const updatedContent = content.replace(/fill="[^"]*"/g, `fill="${adjustColorBrightness(teamColor, 0.3)}"`);
      return match.replace(content, updatedContent);
    });
}

/**
 * Adjust color brightness for accent elements
 */
function adjustColorBrightness(color: string, factor: number): string {
  // Simple brightness adjustment for hex colors
  if (!color.startsWith('#')) return color;
  
  const hex = color.slice(1);
  const r = Math.min(255, Math.floor(parseInt(hex.slice(0, 2), 16) * (1 + factor)));
  const g = Math.min(255, Math.floor(parseInt(hex.slice(2, 4), 16) * (1 + factor)));
  const b = Math.min(255, Math.floor(parseInt(hex.slice(4, 6), 16) * (1 + factor)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Load image from URL with promise wrapper
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG image'));
    img.src = url;
  });
}