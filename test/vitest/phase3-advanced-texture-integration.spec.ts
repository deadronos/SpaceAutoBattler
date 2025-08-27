/**
 * Test for Phase 3 Advanced Texture Management Integration
 * Verifies that AdvancedTextureManager is properly integrated into WebGLRenderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebGLRenderer } from '../../src/webglrenderer';

describe('Phase 3 Advanced Texture Management Integration', () => {
  let canvas: HTMLCanvasElement;
  let renderer: WebGLRenderer;

  beforeEach(() => {
    // Create minimal mock canvas for basic initialization testing
    canvas = {
      getContext: () => null, // No WebGL context available in test environment
      width: 800,
      height: 600
    } as HTMLCanvasElement;

    renderer = new WebGLRenderer(canvas);
  });

  it('should initialize WebGLRenderer without errors when WebGL is not available', () => {
    // This tests graceful fallback when WebGL context cannot be created
    const initResult = renderer.init();
    
    // Should handle missing WebGL context gracefully
    expect(initResult).toBe(false);
  });

  it('should have getAdvancedTextureInfo method available', () => {
    // Test that the new method is properly added to WebGLRenderer
    expect(typeof renderer.getAdvancedTextureInfo).toBe('function');
  });

  it('should return disabled advanced texture info when WebGL is not available', () => {
    // Initialize renderer (will fail to get WebGL context)
    renderer.init();
    
    // Check that advanced texture info returns safe defaults
    const textureInfo = renderer.getAdvancedTextureInfo();
    expect(textureInfo).toBeDefined();
    expect(textureInfo.enabled).toBe(false);
    expect(textureInfo.anisotropyAvailable).toBe(false);
    expect(textureInfo.maxAnisotropy).toBe(0);
  });

  it('should dispose without errors even when WebGL is not available', () => {
    // Initialize and dispose renderer
    renderer.init();
    
    // Disposal should not throw even without WebGL context
    expect(() => renderer.dispose()).not.toThrow();
  });

  it('should maintain API compatibility for existing texture methods', () => {
    // Verify that existing texture-related methods are still available
    expect(typeof renderer.uploadImageBitmapToTexture).toBe('function');
    expect(typeof renderer.dispose).toBe('function');
  });
});

/**
 * Unit test for AdvancedTextureManager in isolation
 */
import { AdvancedTextureManager } from '../../src/webgl/advancedTextureManager';
import { makeGLStub } from './utils/glStub';

describe('AdvancedTextureManager Unit Tests', () => {
  let mockGl: ReturnType<typeof makeGLStub>;
  let manager: AdvancedTextureManager;

  beforeEach(() => {
    mockGl = makeGLStub();
    
    // Create a mock GL context with basic required methods
    const glContext = {
      ...mockGl,
      getExtension: () => null,
      getParameter: () => 1,
      texParameteri: () => {},
      texParameterf: () => {},
      generateMipmap: () => {},
      TEXTURE_2D: 0x0DE1,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      LINEAR: 0x2601,
      LINEAR_MIPMAP_LINEAR: 0x2703
    } as any;

    manager = new AdvancedTextureManager(glContext, null);
  });

  it('should create AdvancedTextureManager instance', () => {
    expect(manager).toBeInstanceOf(AdvancedTextureManager);
  });

  it('should report no anisotropy when extension is not available', () => {
    const info = manager.getCapabilityInfo();
    expect(info.anisotropyAvailable).toBe(false);
    expect(info.maxAnisotropy).toBe(0);
  });

  it('should track texture memory usage', () => {
    const stats = manager.getMemoryStats();
    expect(stats.totalTextures).toBe(0);
    expect(stats.totalMemoryMB).toBe(0);
  });

  it('should create optimal texture configurations', () => {
    const config = manager.createOptimalTexture('sprite');
    expect(config).toBeDefined();
    expect(config.generateMipmaps).toBe(true);
    expect(config.useAnisotropic).toBe(true);
  });
});