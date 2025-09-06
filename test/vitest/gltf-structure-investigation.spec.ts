// Minimal test to inspect Three.js GLTF loading behavior
// This runs in the vitest environment with Three.js available

import { describe, it, expect } from 'vitest';

describe('GLTF Three.js Structure Investigation', () => {
  it('should inspect Three.js GLTF loader output structure', async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    
    console.log('Testing Three.js GLTF loading patterns...');
    
    // Create a mock GLTF structure similar to what GLTFLoader returns
    const mockScene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'TestMesh';
    mockScene.add(mesh);
    
    const mockGltf = {
      scene: mockScene,
      scenes: [mockScene],
      animations: [],
      cameras: [],
      asset: {}
    };
    
    console.log('Mock GLTF structure:');
    console.log('- scene type:', mockGltf.scene.type);
    console.log('- scene has traverse:', typeof mockGltf.scene.traverse);
    
    // Test traversal like the shipModelLoader does
    const foundMeshes: any[] = [];
    mockGltf.scene.traverse((node: any) => {
      console.log(`- Node: type=${node.type}, name=${node.name}`);
      
      if (node.type === 'Mesh') {
        console.log(`  Found mesh: ${node.name}`);
        console.log(`  - geometry type:`, node.geometry?.type);
        console.log(`  - material type:`, node.material?.type);
        console.log(`  - has geometry.clone:`, typeof node.geometry?.clone);
        console.log(`  - has material.clone:`, typeof node.material?.clone);
        
        foundMeshes.push({
          geometry: node.geometry,
          material: node.material
        });
      }
    });
    
    console.log(`Total meshes found: ${foundMeshes.length}`);
    
    expect(foundMeshes.length).toBeGreaterThan(0);
    expect(foundMeshes[0].geometry).toBeTruthy();
    expect(foundMeshes[0].material).toBeTruthy();
    expect(typeof foundMeshes[0].geometry.clone).toBe('function');
    expect(typeof foundMeshes[0].material.clone).toBe('function');
  });
});