import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { shipInstancer } from '../../src/renderer/shipInstancer.js';
import { LRUAssetPool } from '../../src/core/assetPool.js';

// Simple benchmark to demonstrate SVG texture caching performance improvement
describe('SVG Texture Caching Performance', () => {
  let scene: THREE.Scene;
  let parent: THREE.Group;

  beforeEach(() => {
    scene = new THREE.Scene();
    parent = new THREE.Group();
    shipInstancer.init(scene, parent as any);
  });

  it('demonstrates texture reuse reduces allocation overhead', () => {
    // Create a mock ImageBitmap
    const mockImageBitmap = {
      width: 32,
      height: 32,
      close: vi.fn()
    } as ImageBitmap;

    // Create GameState with asset pool
    const gameState = {
      assetPool: new LRUAssetPool(100)
    } as any;

    // Pre-populate with SVG asset
    const svgUrl = 'src/config/assets/svg/fighter.svg';
    gameState.assetPool.set(svgUrl, { imageBitmap: mockImageBitmap });

    // Allocate multiple ships of the same class
    const shipIds = [1, 2, 3, 4, 5];
    
    for (const shipId of shipIds) {
      const allocated = shipInstancer.allocate(shipId, 'fighter', 'red', gameState);
      expect(allocated).toBe(true);
    }

    // Verify that texture was cached and reused
    const textureKey = 'texture:src/config/assets/svg/fighter.svg:autoxauto:default';
    const cachedTexture = gameState.assetPool.get(textureKey);
    expect(cachedTexture).toBeInstanceOf(THREE.Texture);

    // Verify all ships are allocated
    for (const shipId of shipIds) {
      expect(shipInstancer.hasShip(shipId)).toBe(true);
    }

    // Asset pool should contain: 1 ImageBitmap + 1 cached texture = 2 items
    expect(gameState.assetPool.size).toBe(2);
    
    console.log('✓ Successfully cached texture for reuse across multiple ship allocations');
    console.log('✓ Asset pool contains exactly 1 ImageBitmap + 1 Texture (optimal)');
    console.log('✓ Performance improvement: Created 1 texture for 5 ships (5x reuse)');
  });
});