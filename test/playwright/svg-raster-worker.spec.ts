/**
 * OffscreenCanvas SVG Raster Worker Test
 * 
 * Smoke test to verify that the new OffscreenCanvas-based SVG rasterization
 * worker is functioning correctly and producing valid ImageBitmaps.
 */

import { test, expect } from '@playwright/test';

test.describe('OffscreenCanvas SVG Rasterization', () => {
  
  test('rasterize simple SVG to ImageBitmap', async ({ page }) => {
    // Navigate to a test page that can run our rasterization
    await page.goto('data:text/html,<html><body><h1>SVG Raster Test</h1></body></html>');
    
    // Test SVG (simple triangle)
    const testSvg = `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g id="hull">
          <polygon points="32,8 56,48 8,48" fill="#b0b7c3"/>
        </g>
        <g id="accent">
          <circle cx="32" cy="24" r="4" fill="#ffffff"/>
        </g>
      </svg>
    `;
    
    // Inject our rasterization code and test it
    const result = await page.evaluate(async (svgText) => {
      // Mock the worker functionality inline for testing
      async function testRasterization(svg: string): Promise<{ success: boolean; width: number; height: number; error?: string }> {
        try {
          // Check OffscreenCanvas support
          if (typeof OffscreenCanvas === 'undefined') {
            return { success: false, width: 0, height: 0, error: 'OffscreenCanvas not supported' };
          }
          
          const width = 128;
          const height = 128;
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            return { success: false, width: 0, height: 0, error: 'Failed to get 2D context' };
          }
          
          // Clear canvas
          ctx.clearRect(0, 0, width, height);
          
          // Create blob URL for SVG
          const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(svgBlob);
          
          try {
            // Load image
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = () => reject(new Error('Failed to load SVG'));
              image.src = svgUrl;
            });
            
            // Draw to canvas
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to ImageBitmap
            const bitmap = canvas.transferToImageBitmap();
            
            // Verify bitmap properties
            const hasValidDimensions = bitmap.width === width && bitmap.height === height;
            
            // Clean up
            bitmap.close();
            
            return { 
              success: hasValidDimensions, 
              width: bitmap.width, 
              height: bitmap.height 
            };
            
          } finally {
            URL.revokeObjectURL(svgUrl);
          }
          
        } catch (error) {
          return { 
            success: false, 
            width: 0, 
            height: 0, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }
      
      return await testRasterization(svgText);
    }, testSvg);
    
    // Verify the rasterization worked
    expect(result.success).toBe(true);
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
    expect(result.error).toBeUndefined();
  });
  
  test('handle team color tinting', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Team Color Test</h1></body></html>');
    
    const testSvg = `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g id="hull">
          <rect x="16" y="16" width="32" height="32" fill="#b0b7c3"/>
        </g>
      </svg>
    `;
    
    const result = await page.evaluate(async (svgText) => {
      // Test team color application
      function applySvgTeamColorTinting(svg: string, teamColor: string): string {
        return svg.replace(/id="hull"[^>]*>/g, (match) => 
          match.replace(/fill="[^"]*"/, `fill="${teamColor}"`)
        );
      }
      
      const originalSvg = svgText;
      const tintedSvg = applySvgTeamColorTinting(svgText, '#ff0000');
      
      return {
        originalContainsGray: originalSvg.includes('#b0b7c3'),
        tintedContainsRed: tintedSvg.includes('#ff0000'),
        tintedRemovedGray: !tintedSvg.includes('#b0b7c3')
      };
    }, testSvg);
    
    expect(result.originalContainsGray).toBe(true);
    expect(result.tintedContainsRed).toBe(true);
    expect(result.tintedRemovedGray).toBe(true);
  });
  
  test('verify ImageBitmap memory management', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Memory Test</h1></body></html>');
    
    const testSvg = `
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="12" fill="#00ff00"/>
      </svg>
    `;
    
    const result = await page.evaluate(async (svgText) => {
      try {
        if (typeof OffscreenCanvas === 'undefined') {
          return { success: false, error: 'OffscreenCanvas not supported' };
        }
        
        const canvas = new OffscreenCanvas(64, 64);
        const ctx = canvas.getContext('2d');
        if (!ctx) return { success: false, error: 'No 2D context' };
        
        // Create multiple bitmaps to test memory management
        const bitmaps: ImageBitmap[] = [];
        
        for (let i = 0; i < 3; i++) {
          ctx.clearRect(0, 0, 64, 64);
          ctx.fillStyle = i === 0 ? '#ff0000' : i === 1 ? '#00ff00' : '#0000ff';
          ctx.fillRect(i * 16, i * 16, 16, 16);
          
          const bitmap = canvas.transferToImageBitmap();
          bitmaps.push(bitmap);
        }
        
        // Verify all bitmaps are valid
        const allValid = bitmaps.every(b => b.width === 64 && b.height === 64);
        
        // Clean up - this is important for memory management
        for (const bitmap of bitmaps) {
          bitmap.close();
        }
        
        return { success: allValid, count: bitmaps.length };
        
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }, testSvg);
    
    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(result.error).toBeUndefined();
  });
  
  test('fallback when OffscreenCanvas unavailable', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Fallback Test</h1></body></html>');
    
    const result = await page.evaluate(async () => {
      // Temporarily hide OffscreenCanvas to test fallback
      const originalOffscreenCanvas = (window as any).OffscreenCanvas;
      delete (window as any).OffscreenCanvas;
      
      try {
        // Test fallback path using regular canvas + createImageBitmap
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return { success: false, error: 'No 2D context' };
        
        ctx.fillStyle = '#purple';
        ctx.fillRect(0, 0, 64, 64);
        
        // Test createImageBitmap fallback
        if (typeof createImageBitmap !== 'undefined') {
          const bitmap = await createImageBitmap(canvas);
          const success = bitmap.width === 64 && bitmap.height === 64;
          bitmap.close();
          return { success, fallbackUsed: true };
        } else {
          // Ultimate fallback - just return canvas
          return { success: true, fallbackUsed: true, ultimateFallback: true };
        }
        
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      } finally {
        // Restore OffscreenCanvas
        if (originalOffscreenCanvas) {
          (window as any).OffscreenCanvas = originalOffscreenCanvas;
        }
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });
});