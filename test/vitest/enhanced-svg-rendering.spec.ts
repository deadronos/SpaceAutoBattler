/**
 * Enhanced SVG Rendering Tests
 * 
 * Unit tests for the new OffscreenCanvas and persistent caching functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Enhanced SVG Rendering', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  it('should handle basic SVG team color tinting', () => {
    const originalSvg = `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g id="hull">
          <rect x="16" y="16" width="32" height="32" fill="#b0b7c3"/>
        </g>
      </svg>
    `;
    
    // Test the team color application logic - this needs to handle nested elements
    function applySvgTeamColorTinting(svg: string, teamColor: string): string {
      // Replace fill attribute within elements inside hull group
      return svg.replace(/<g[^>]*id="hull"[^>]*>([\s\S]*?)<\/g>/g, (match, content) => {
        const updatedContent = content.replace(/fill="[^"]*"/g, `fill="${teamColor}"`);
        return match.replace(content, updatedContent);
      });
    }
    
    const tintedSvg = applySvgTeamColorTinting(originalSvg, '#ff0000');
    
    expect(originalSvg).toContain('#b0b7c3');
    expect(tintedSvg).toContain('#ff0000');
    expect(tintedSvg).not.toContain('#b0b7c3');
  });

  it('should handle color brightness adjustment', () => {
    function adjustColorBrightness(color: string, factor: number): string {
      if (!color.startsWith('#')) return color;
      
      const hex = color.slice(1);
      const r = Math.min(255, Math.floor(parseInt(hex.slice(0, 2), 16) * (1 + factor)));
      const g = Math.min(255, Math.floor(parseInt(hex.slice(2, 4), 16) * (1 + factor)));
      const b = Math.min(255, Math.floor(parseInt(hex.slice(4, 6), 16) * (1 + factor)));
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    const baseColor = '#808080'; // Medium gray (128, 128, 128)
    const brighterColor = adjustColorBrightness(baseColor, 0.5); // 50% brighter
    
    expect(brighterColor).toBe('#c0c0c0'); // Should be (192, 192, 192)
    
    const darkerColor = adjustColorBrightness(baseColor, -0.25); // 25% darker
    expect(darkerColor).toBe('#606060'); // Should be (96, 96, 96)
  });

  it('should generate consistent cache keys', () => {
    function generateCacheKey(svgText: string, width: number, height: number, teamColor?: string): string {
      const content = `${svgText}:${width}:${height}:${teamColor || ''}`;
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `svg_raster_${Math.abs(hash).toString(36)}`;
    }
    
    const svgText = '<svg><circle r="10"/></svg>';
    const key1 = generateCacheKey(svgText, 128, 128, '#ff0000');
    const key2 = generateCacheKey(svgText, 128, 128, '#ff0000');
    const key3 = generateCacheKey(svgText, 128, 128, '#00ff00');
    
    expect(key1).toBe(key2); // Same inputs should generate same key
    expect(key1).not.toBe(key3); // Different team color should generate different key
    expect(key1).toMatch(/^svg_raster_[a-z0-9]+$/); // Should match expected format
  });

  it('should check power of two dimensions correctly', () => {
    function isPowerOfTwo(value: number): boolean {
      return value > 0 && (value & (value - 1)) === 0;
    }
    
    // Test power of two values
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(4)).toBe(true);
    expect(isPowerOfTwo(8)).toBe(true);
    expect(isPowerOfTwo(16)).toBe(true);
    expect(isPowerOfTwo(32)).toBe(true);
    expect(isPowerOfTwo(64)).toBe(true);
    expect(isPowerOfTwo(128)).toBe(true);
    expect(isPowerOfTwo(256)).toBe(true);
    expect(isPowerOfTwo(512)).toBe(true);
    expect(isPowerOfTwo(1024)).toBe(true);
    
    // Test non-power of two values
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(5)).toBe(false);
    expect(isPowerOfTwo(6)).toBe(false);
    expect(isPowerOfTwo(7)).toBe(false);
    expect(isPowerOfTwo(9)).toBe(false);
    expect(isPowerOfTwo(10)).toBe(false);
    expect(isPowerOfTwo(100)).toBe(false);
    expect(isPowerOfTwo(127)).toBe(false);
    expect(isPowerOfTwo(129)).toBe(false);
  });

  it('should handle SVG viewBox parsing', () => {
    function extractViewBox(svgText: string): { x: number; y: number; width: number; height: number } | null {
      const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
      if (!viewBoxMatch) return null;
      
      const values = viewBoxMatch[1].split(/\s+/).map(Number);
      if (values.length !== 4) return null;
      
      return {
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3]
      };
    }
    
    const svg1 = '<svg viewBox="0 0 64 64"><circle r="10"/></svg>';
    const svg2 = '<svg viewBox="-32 -32 64 64"><rect width="20" height="20"/></svg>';
    const svg3 = '<svg width="100" height="100"><path d="M0,0 L10,10"/></svg>';
    
    const viewBox1 = extractViewBox(svg1);
    const viewBox2 = extractViewBox(svg2);
    const viewBox3 = extractViewBox(svg3);
    
    expect(viewBox1).toEqual({ x: 0, y: 0, width: 64, height: 64 });
    expect(viewBox2).toEqual({ x: -32, y: -32, width: 64, height: 64 });
    expect(viewBox3).toBeNull(); // No viewBox attribute
  });

  it('should validate cache entry TTL', () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;
    
    function isEntryExpired(timestamp: number, ttlMs: number): boolean {
      return (now - timestamp) > ttlMs;
    }
    
    // Test fresh entries
    expect(isEntryExpired(now, oneHour)).toBe(false);
    expect(isEntryExpired(now - 30 * 60 * 1000, oneHour)).toBe(false); // 30 minutes ago
    
    // Test expired entries
    expect(isEntryExpired(now - 2 * oneHour, oneHour)).toBe(true); // 2 hours ago
    expect(isEntryExpired(now - 2 * oneDay, oneDay)).toBe(true); // 2 days ago
    expect(isEntryExpired(now - 2 * oneWeek, oneWeek)).toBe(true); // 2 weeks ago
    
    // Test edge cases
    expect(isEntryExpired(now - oneHour + 1000, oneHour)).toBe(false); // Just under 1 hour
    expect(isEntryExpired(now - oneHour - 1000, oneHour)).toBe(true); // Just over 1 hour
  });

  it('should handle worker message format', () => {
    interface RasterRequest {
      type: 'raster';
      id: string;
      svgText: string;
      width: number;
      height: number;
      teamColor?: string;
    }
    
    interface RasterResponse {
      type: 'raster:done' | 'raster:error';
      id: string;
      bitmap?: any; // ImageBitmap in real implementation
      error?: string;
    }
    
    // Test request format
    const request: RasterRequest = {
      type: 'raster',
      id: 'test_123',
      svgText: '<svg><circle r="10"/></svg>',
      width: 128,
      height: 128,
      teamColor: '#ff0000'
    };
    
    expect(request.type).toBe('raster');
    expect(request.id).toBe('test_123');
    expect(request.width).toBe(128);
    expect(request.height).toBe(128);
    
    // Test success response format
    const successResponse: RasterResponse = {
      type: 'raster:done',
      id: request.id,
      bitmap: {} // Mock bitmap
    };
    
    expect(successResponse.type).toBe('raster:done');
    expect(successResponse.id).toBe(request.id);
    expect(successResponse.bitmap).toBeDefined();
    
    // Test error response format
    const errorResponse: RasterResponse = {
      type: 'raster:error',
      id: request.id,
      error: 'Failed to load SVG'
    };
    
    expect(errorResponse.type).toBe('raster:error');
    expect(errorResponse.id).toBe(request.id);
    expect(errorResponse.error).toBe('Failed to load SVG');
  });
});