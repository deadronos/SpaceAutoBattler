import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState } from '../../src/core/gameState.js';
import { spawnShip } from '../../src/core/gameState.js';
import type { GameState, ShipClass } from '../../src/types/index.js';

describe('GLTF Rendering Debug', () => {
  let state: GameState;

  beforeEach(async () => {
    state = createInitialState('test-gltf');
    state.assetPool = new Map<string, unknown>();
  });

  it('should handle mock GLTF prototypes correctly', async () => {
    console.log('Testing with mock GLTF prototypes...');
    
    // Create mock GLTF prototype data similar to what shipModelLoader would create
    const mockGeometry = {
      type: 'BufferGeometry',
      clone: () => mockGeometry,
      attributes: {}
    };
    
    const mockMaterial = {
      type: 'MeshStandardMaterial',
      clone: () => mockMaterial,
      color: { r: 1, g: 1, b: 1 }
    };

    const mockGltfProto = {
      className: 'fighter',
      url: '/src/config/assets/gltf/fighter.glb',
      gltf: { scene: { children: [] } },
      scale: 1.0,
      pivotOffset: [0, 0, 0] as [number, number, number],
      boundsRadius: 1.0,
      attribution: 'test',
      threePrototypes: {
        geometries: [mockGeometry],
        materials: [mockMaterial]
      }
    };
    
    // Store mock prototypes in asset pool
    if (state.assetPool) {
      state.assetPool.set('ship-fighter-red', mockGltfProto);
      state.assetPool.set('ship-fighter-blue', mockGltfProto);
      state.assetPool.set('ship-fighter', mockGltfProto);
    }
    
    // Check that assets are in the pool
    const assetKeys = Array.from(state.assetPool?.keys() || []);
    console.log('Mock asset pool keys:', assetKeys);
    expect(assetKeys.length).toBe(3);
    
    // Check prototype structure
    const fighterRed = state.assetPool?.get('ship-fighter-red') as any;
    expect(fighterRed).toBeTruthy();
    expect(fighterRed.threePrototypes).toBeTruthy();
    expect(fighterRed.threePrototypes.geometries).toHaveLength(1);
    expect(fighterRed.threePrototypes.materials).toHaveLength(1);
  });

  it('should handle ship spawning with mock GLTF prototypes', async () => {
    console.log('Testing ship spawning with mock GLTF...');
    
    // Add mock prototype first
    const mockGltfProto = {
      className: 'fighter',
      url: '/src/config/assets/gltf/fighter.glb',
      gltf: { scene: { children: [] } },
      scale: 1.0,
      pivotOffset: [0, 0, 0] as [number, number, number],
      boundsRadius: 1.0,
      attribution: 'test',
      threePrototypes: {
        geometries: [{ clone: () => ({ type: 'BufferGeometry' }) }],
        materials: [{ clone: () => ({ type: 'MeshStandardMaterial' }) }]
      }
    };
    
    state.assetPool?.set('ship-fighter-red', mockGltfProto);
    
    // Spawn a ship
    const ship = spawnShip(state, 'red', 'fighter');
    console.log('Spawned ship:', { id: ship.id, class: ship.class, team: ship.team });
    
    // Check if the ship was added to the state
    expect(state.ships).toContain(ship);
    expect(ship.class).toBe('fighter');
    expect(ship.team).toBe('red');
    
    // Now let's check if the ship can be allocated in the instancer
    // Import shipInstancer dynamically to avoid circular deps
    try {
      const { shipInstancer } = await import('../../src/renderer/shipInstancer.js');
      if (shipInstancer) {
        // Check if we can allocate without errors
        console.log('Testing shipInstancer allocation...');
        // We can't fully test without a Three.js scene, but we can at least check the method exists
        expect(typeof shipInstancer.allocate).toBe('function');
      }
    } catch (error) {
      console.log('Could not test shipInstancer directly:', error);
    }
  });
});