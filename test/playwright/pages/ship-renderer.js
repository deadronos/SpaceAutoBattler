/**
 * Ship Renderer Test Page
 * 
 * Minimal Three.js scene for rendering ship GLTF models in a deterministic test environment.
 * Exposes window.__TEST__ API for Playwright coordination.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Configuration from query params
const params = new URLSearchParams(window.location.search);
const hullId = params.get('hull') || 'fighter';
const frame = parseInt(params.get('frame') || '0', 10);
const shieldEnabled = params.get('shield') === 'true';
const engineEnabled = params.get('engine') === 'true';
const postprocessing = params.get('postprocessing') !== 'false';

// Status display
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');

function updateStatus(text) {
  statusEl.textContent = text;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  updateStatus('Error');
}

// Scene setup
const canvas = document.getElementById('canvas');
const width = 1280;
const height = 800;

canvas.width = width;
canvas.height = height;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Fixed camera position for deterministic rendering
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 2, 10);
camera.lookAt(0, 0, 0);

// Fixed lighting for deterministic rendering
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ 
  canvas, 
  antialias: true,
  alpha: false 
});
renderer.setSize(width, height);
renderer.setPixelRatio(1); // Fixed pixel ratio for deterministic rendering

// GLTF loader
const loader = new GLTFLoader();

// Ship model paths (matching src/assets/ships.ts pattern)
const SHIP_MODEL_PATHS = {
  fighter: '../../../src/assets/gltf/fighter.glb',
  corvette: '../../../src/assets/gltf/corvette.glb',
  frigate: '../../../src/assets/gltf/frigate.glb',
  destroyer: '../../../src/assets/gltf/destroyer.glb',
  carrier: '../../../src/assets/gltf/carrier.glb',
};

// Test state
let shipModel = null;
let isReady = false;
let renderComplete = false;

/**
 * Scene summary for test assertions
 */
function getSceneSummary() {
  if (!shipModel) {
    return { error: 'Ship model not loaded' };
  }

  const meshes = [];
  const materials = [];
  const uniforms = {};

  shipModel.traverse((node) => {
    if (node.isMesh) {
      const box = new THREE.Box3().setFromObject(node);
      meshes.push({
        name: node.name,
        visible: node.visible,
        boundingBox: {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z }
        }
      });

      if (node.material) {
        const mat = node.material;
        const matInfo = {
          name: mat.name,
          type: mat.type,
          visible: node.visible
        };

        // Capture key properties
        if (mat.emissive) {
          matInfo.emissive = mat.emissive.getHex();
          matInfo.emissiveIntensity = mat.emissiveIntensity || 0;
        }
        if (mat.color) {
          matInfo.color = mat.color.getHex();
        }
        if (mat.opacity !== undefined) {
          matInfo.opacity = mat.opacity;
        }
        if (mat.transparent !== undefined) {
          matInfo.transparent = mat.transparent;
        }

        // Capture shader uniforms if available
        if (mat.uniforms) {
          Object.keys(mat.uniforms).forEach(key => {
            const uniform = mat.uniforms[key];
            if (uniform && uniform.value !== undefined) {
              // Store primitive values only
              if (typeof uniform.value === 'number' || typeof uniform.value === 'boolean') {
                uniforms[key] = uniform.value;
              }
            }
          });
        }

        materials.push(matInfo);
      }
    }
  });

  return {
    hullId,
    frameRendered: frame,
    shieldEnabled,
    engineEnabled,
    meshCount: meshes.length,
    meshes,
    materials,
    uniforms
  };
}

/**
 * Load ship model
 */
async function loadShip() {
  updateStatus(`Loading ${hullId}...`);

  const modelPath = SHIP_MODEL_PATHS[hullId];
  if (!modelPath) {
    throw new Error(`Unknown hull ID: ${hullId}`);
  }

  return new Promise((resolve, reject) => {
    loader.load(
      modelPath,
      (gltf) => {
        shipModel = gltf.scene;
        scene.add(shipModel);
        
        // Center the model
        const box = new THREE.Box3().setFromObject(shipModel);
        const center = box.getCenter(new THREE.Vector3());
        shipModel.position.sub(center);
        
        updateStatus(`Loaded ${hullId}`);
        resolve();
      },
      (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(0);
        updateStatus(`Loading ${hullId}... ${percent}%`);
      },
      (error) => {
        reject(new Error(`Failed to load ${hullId}: ${error.message}`));
      }
    );
  });
}

/**
 * Render a single frame
 */
function renderFrame() {
  renderer.render(scene, camera);
  renderComplete = true;
  updateStatus(`Rendered frame ${frame}`);
}

/**
 * Initialize and render
 */
async function init() {
  try {
    await loadShip();
    
    // Apply any test-specific modifications here
    // TODO: Add shield/engine state modifications when implemented
    
    // Render the target frame
    renderFrame();
    
    isReady = true;
    updateStatus('Ready');
  } catch (error) {
    showError(error.message);
    console.error(error);
  }
}

/**
 * Test API exposed to Playwright
 */
window.__TEST__ = {
  /**
   * Wait for the renderer to be ready and frame rendered
   */
  async waitForReady() {
    if (isReady && renderComplete) {
      return { frameRendered: frame };
    }
    
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (isReady && renderComplete) {
          clearInterval(checkReady);
          resolve({ frameRendered: frame });
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        resolve({ error: 'Timeout waiting for ready', frameRendered: -1 });
      }, 30000);
    });
  },

  /**
   * Get scene summary for assertions
   */
  async getSceneSummary() {
    return getSceneSummary();
  },

  /**
   * Set test options (for future extension)
   */
  async setOptions(options) {
    // TODO: Implement dynamic option changes
    console.log('setOptions called:', options);
    return { success: true };
  }
};

// Start initialization
init();
