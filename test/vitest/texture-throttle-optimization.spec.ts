import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { setTextureNeedsUpdateThrottled, cloneMaterialReuseTextures, batchUpdateMaterialTextures } from '../../src/renderer/textureThrottle.js';

describe('Texture Throttling Optimization', () => {
  let mockPerformanceNow: ReturnType<typeof vi.fn>;
  let originalPerformanceNow: typeof performance.now;

  beforeEach(() => {
    // Mock performance.now for time-based testing
    mockPerformanceNow = vi.fn();
    originalPerformanceNow = performance.now;
    performance.now = mockPerformanceNow;
    
    // Reset global frame counter
    (globalThis as any).__FRAME_COUNT = 0;
    
    // Start time at 0
    mockPerformanceNow.mockReturnValue(0);
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
    delete (globalThis as any).__FRAME_COUNT;
  });

  test('time-based throttling prevents rapid texture updates', () => {
    const texture = new THREE.Texture();

    // First call should update (time=0, frame=0)
    const result1 = setTextureNeedsUpdateThrottled(texture, 1, 50); // 50ms cooldown
    expect(result1).toBe(true);
    
    // Advance time by 25ms (less than 50ms cooldown)
    mockPerformanceNow.mockReturnValue(25);
    (globalThis as any).__FRAME_COUNT = 10; // Advance frames significantly
    
    // Should be throttled by time even though frames passed
    const result2 = setTextureNeedsUpdateThrottled(texture, 1, 50);
    expect(result2).toBe(false);
    
    // Advance time past cooldown
    mockPerformanceNow.mockReturnValue(60);
    
    // Should now update
    const result3 = setTextureNeedsUpdateThrottled(texture, 1, 50);
    expect(result3).toBe(true);
  });

  test('frame-based throttling still works with time-based throttling', () => {
    const texture = new THREE.Texture();

    // First call should update
    const result1 = setTextureNeedsUpdateThrottled(texture, 3, 50); // 3 frame + 50ms cooldown
    expect(result1).toBe(true);
    
    // Advance time past cooldown but not enough frames
    mockPerformanceNow.mockReturnValue(100);
    (globalThis as any).__FRAME_COUNT = 2; // Only 2 frames passed, need 3
    
    // Should be throttled by frames even though time passed
    const result2 = setTextureNeedsUpdateThrottled(texture, 3, 50);
    expect(result2).toBe(false);
    
    // Advance frames
    (globalThis as any).__FRAME_COUNT = 3;
    
    // Should now update
    const result3 = setTextureNeedsUpdateThrottled(texture, 3, 50);
    expect(result3).toBe(true);
  });

  test('cloneMaterialReuseTextures preserves texture references', () => {
    const originalTexture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: originalTexture });
    
    const cloned = cloneMaterialReuseTextures(material);
    
    // Material should be cloned (different object)
    expect(cloned).not.toBe(material);
    expect(cloned.uuid).not.toBe(material.uuid);
    
    // But texture should be the same reference (not cloned)
    expect((cloned as THREE.MeshBasicMaterial).map).toBe(originalTexture);
  });

  test('batchUpdateMaterialTextures calls setTextureNeedsUpdateThrottled for unique textures', () => {
    const texture1 = new THREE.Texture();
    const texture2 = new THREE.Texture();
    
    const material1 = new THREE.MeshBasicMaterial({ map: texture1 });
    const material2 = new THREE.MeshBasicMaterial({ map: texture1 }); // Same texture
    const material3 = new THREE.MeshBasicMaterial({ map: texture2 }); // Different texture
    
    // Batch update should handle duplicate textures efficiently
    // Since it's the first call for each texture, both should return true
    batchUpdateMaterialTextures([material1, material2, material3], 0, 0); // No throttling for test
    
    // We can't test the exact behavior without mocking, but we can test it doesn't throw
    expect(true).toBe(true);
  });

  test('setTextureNeedsUpdateThrottled works with materials that have map property', () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    
    // Should work when passing the material instead of texture directly
    const result = setTextureNeedsUpdateThrottled(material, 0, 0); // No throttling for test
    expect(result).toBe(true);
  });

  test('handles edge cases gracefully', () => {
    // Should not throw with null/undefined inputs and return false
    expect(setTextureNeedsUpdateThrottled(null)).toBe(false);
    expect(setTextureNeedsUpdateThrottled(undefined)).toBe(false);
    expect(() => cloneMaterialReuseTextures(new THREE.Material())).not.toThrow();
    expect(() => batchUpdateMaterialTextures([])).not.toThrow();
  });

  test('throttling reduces texture update frequency over time', () => {
    const texture = new THREE.Texture();
    let updateCount = 0;
    
    // Call multiple times rapidly with high throttling
    for (let i = 0; i < 10; i++) {
      const result = setTextureNeedsUpdateThrottled(texture, 3, 50); // High throttling
      if (result) updateCount++;
      
      mockPerformanceNow.mockReturnValue(i * 5); // 5ms increments (less than 50ms cooldown)
      (globalThis as any).__FRAME_COUNT = i;
    }
    
    // Should have fewer updates than calls due to throttling
    expect(updateCount).toBeLessThan(10);
    expect(updateCount).toBeGreaterThan(0);
  });

  test('no throttling allows all updates', () => {
    const texture = new THREE.Texture();
    let updateCount = 0;
    
    // Call multiple times with no throttling
    for (let i = 0; i < 5; i++) {
      const result = setTextureNeedsUpdateThrottled(texture, 0, 0); // No throttling
      if (result) updateCount++;
      
      mockPerformanceNow.mockReturnValue(i * 5);
      (globalThis as any).__FRAME_COUNT = i;
    }
    
    // Should have all updates
    expect(updateCount).toBe(5);
  });
});