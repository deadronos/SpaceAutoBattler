import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { GameState, Ship, Bullet } from '../types/index.js';

// Enable accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

export interface BVHManager {
  initDone: boolean;
  updateBVH: (ships: Ship[]) => void;
  raycast: (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance?: number) => THREE.Intersection[];
  sphereCast: (center: THREE.Vector3, radius: number) => Ship[];
  dispose: () => void;
}

export function createBVHManager(state: GameState): BVHManager {
  // BVH for ships
  let shipBVH: MeshBVH | null = null;
  let shipGeometry: THREE.BufferGeometry | null = null;
  let shipMesh: THREE.Mesh | null = null;

  // Scene for BVH operations
  const bvhScene = new THREE.Scene();

  function updateBVH(ships: Ship[]) {
    // Clear previous BVH
    if (shipMesh) {
      bvhScene.remove(shipMesh);
      shipMesh.geometry.dispose();
      if (shipMesh.material instanceof THREE.Material) {
        shipMesh.material.dispose();
      }
    }

    if (ships.length === 0) {
      shipBVH = null;
      return;
    }

    // Create geometry for all ships
    const positions: number[] = [];
    const indices: number[] = [];
    const shipData: Ship[] = []; // Store ship references

    ships.forEach((ship, shipIndex) => {
      // Create a simple bounding box for each ship
      const halfWidth = 10; // Ship half-width
      const halfHeight = 5; // Ship half-height
      const halfDepth = 10; // Ship half-depth

      // Define 8 vertices of the bounding box
      const vertices = [
        // Bottom face
        ship.pos.x - halfWidth, ship.pos.y - halfHeight, ship.pos.z - halfDepth,
        ship.pos.x + halfWidth, ship.pos.y - halfHeight, ship.pos.z - halfDepth,
        ship.pos.x + halfWidth, ship.pos.y - halfHeight, ship.pos.z + halfDepth,
        ship.pos.x - halfWidth, ship.pos.y - halfHeight, ship.pos.z + halfDepth,
        // Top face
        ship.pos.x - halfWidth, ship.pos.y + halfHeight, ship.pos.z - halfDepth,
        ship.pos.x + halfWidth, ship.pos.y + halfHeight, ship.pos.z - halfDepth,
        ship.pos.x + halfWidth, ship.pos.y + halfHeight, ship.pos.z + halfDepth,
        ship.pos.x - halfWidth, ship.pos.y + halfHeight, ship.pos.z + halfDepth,
      ];

      const vertexOffset = positions.length / 3;

      // Add vertices
      positions.push(...vertices);

      // Define triangles for the bounding box
      const boxIndices = [
        // Bottom face
        0, 1, 2, 0, 2, 3,
        // Top face
        4, 5, 6, 4, 6, 7,
        // Front face
        0, 1, 5, 0, 5, 4,
        // Back face
        3, 2, 6, 3, 6, 7,
        // Left face
        0, 3, 7, 0, 7, 4,
        // Right face
        1, 2, 6, 1, 6, 5,
      ];

      // Add indices with offset
      indices.push(...boxIndices.map(i => i + vertexOffset));

      // Store ship reference (we'll use the ship index to map back)
      shipData[shipIndex] = ship;
    });

    // Create geometry
    shipGeometry = new THREE.BufferGeometry();
    shipGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    shipGeometry.setIndex(indices);

    // Compute BVH
    shipGeometry.computeBoundsTree();

    // Create mesh
    const material = new THREE.MeshBasicMaterial({ visible: false }); // Invisible helper mesh
    shipMesh = new THREE.Mesh(shipGeometry, material);
    bvhScene.add(shipMesh);

    // Store BVH reference
    shipBVH = (shipGeometry as any).boundsTree;
  }

  function raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance = 1000): THREE.Intersection[] {
    if (!shipBVH || !shipMesh) return [];

    const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, maxDistance);

    // Perform raycast against BVH
    const intersections: THREE.Intersection[] = [];
    raycaster.intersectObject(shipMesh, false, intersections);

    return intersections;
  }

  function sphereCast(center: THREE.Vector3, radius: number): Ship[] {
    if (!shipBVH || !shipMesh) return [];

    // For sphere casting, we'll use a simple distance check against all ships
    // In a more advanced implementation, you could use BVH for sphere queries
    const hits: Ship[] = [];

    state.ships.forEach(ship => {
      const distance = Math.sqrt(
        Math.pow(ship.pos.x - center.x, 2) +
        Math.pow(ship.pos.y - center.y, 2) +
        Math.pow(ship.pos.z - center.z, 2)
      );

      if (distance <= radius) {
        hits.push(ship);
      }
    });

    return hits;
  }

  return {
    initDone: true,
    updateBVH,
    raycast,
    sphereCast,
    dispose: () => {
      if (shipMesh) {
        bvhScene.remove(shipMesh);
        shipMesh.geometry.dispose();
        if (shipMesh.material instanceof THREE.Material) {
          shipMesh.material.dispose();
        }
      }
      shipBVH = null;
      shipGeometry = null;
      shipMesh = null;
    }
  };
}