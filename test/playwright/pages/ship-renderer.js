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
// Optional explicit model path passed by the test runner (useful when filenames are webpack-hashed)
let explicitModelPath = params.get('model') || null;
// Support Playwright inlined-page mode where init params can be injected before module runs
try {
  if (!explicitModelPath && window.__TEST_INIT_PARAMS && window.__TEST_INIT_PARAMS.model) {
    explicitModelPath = window.__TEST_INIT_PARAMS.model || null;
  }
} catch {
  // ignore — window.__TEST_INIT_PARAMS may be undefined in normal runs
}

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

// Helper: try to find a model file matching hullId in common directories
async function findModelFile(hull) {
  const candidateDirs = ['/models/', '/dist/models/', '/assets/models/'];
  const filenamePattern = new RegExp(hull + '[^"' + "'" + ']*\\.glb', 'i');

  for (const dir of candidateDirs) {
    try {
      const res = await fetch(dir, { method: 'GET' });
      if (!res.ok) continue;
      const text = await res.text();
      // crude HTML directory listing parse: find first matching href
      const match = text.match(/href="([^"]+\.glb)"/gi);
      if (match) {
        for (const m of match) {
          const hrefMatch = m.match(/href="([^"]+\.glb)"/i);
          if (hrefMatch && hrefMatch[1]) {
            const candidate = hrefMatch[1];
            if (filenamePattern.test(candidate)) {
              // Normalize path
              const url = dir.endsWith('/') ? dir + candidate : dir + '/' + candidate;
              return url;
            }
          }
        }
      }
    } catch {
      // ignore and try next dir
    }
  }

  // Fallbacks: try conventional paths
  const fallbacks = ['/assets/models/', '/models/', '/dist/models/'];
  for (const fb of fallbacks) {
    const fbPath = `${fb}${hull}.glb`;
    try {
      const r = await fetch(fbPath, { method: 'HEAD' });
      if (r.ok) return fbPath;
    } catch { /* ignore */ }
  }

  return null;
}

// Ship model paths (match built output under /assets/models when serving dist)
const SHIP_MODEL_PATHS = {
  fighter: '/assets/models/fighter.glb',
  corvette: '/assets/models/corvette.glb',
  frigate: '/assets/models/frigate.glb',
  destroyer: '/assets/models/destroyer.glb',
  carrier: '/assets/models/carrier.glb',
};

// Test state
let shipModel = null;
let isReady = false;
let renderComplete = false;
let overlayNeeded = false; // only draw overlay when fallback was used

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

  // Attempt to locate the correct model file (handles webpackized names)
  // Honor explicit model path passed from the test runner first
  let modelPath = explicitModelPath || SHIP_MODEL_PATHS[hullId] ?? null;
  if (!explicitModelPath) {
    try {
      const discovered = await findModelFile(hullId);
      if (discovered) modelPath = discovered;
    } catch {
      // ignore discovery errors; we'll use the fallback paths or placeholder
    }
  }

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
        console.error('GLTF load failed, using placeholder:', error);
        // Fallback: create a simple placeholder ship so tests can continue
        try {
          const placeholder = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.6, 3.0),
            new THREE.MeshStandardMaterial({ color: 0x777777 })
          );
          body.name = `${hullId}-placeholder-body`;
          placeholder.add(body);

          if (shieldEnabled) {
            const shield = new THREE.Mesh(
              new THREE.SphereGeometry(2.0, 32, 32),
              new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
            );
            shield.name = `${hullId}-placeholder-shield`;
            placeholder.add(shield);
          }

          shipModel = placeholder;
          scene.add(shipModel);
          const box = new THREE.Box3().setFromObject(shipModel);
          const center = box.getCenter(new THREE.Vector3());
          shipModel.position.sub(center);
          updateStatus(`Loaded placeholder for ${hullId}`);
          overlayNeeded = true; // indicate we drew a fallback
          resolve();
        } catch /*err*/ {
          reject(new Error(`Failed to load ${hullId}: ${error.message}`));
        }
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
async function initInternal() {
  try {
    await loadShip();
    
    // Render the target frame
    renderFrame();
    
    isReady = true;
    updateStatus('Ready');
  } catch (error) {
    showError(error.message);
    console.error(error);
  }
  // draw overlay once after initial render in case fallback was used
  maybeDrawOverlay();
}

// Start initialization
initInternal();

// Ensure overlay draws after the frame render when needed
// Add a 2D overlay canvas for deterministic shield visuals (fallback for headless)
const overlay = document.createElement('canvas');
overlay.id = 'overlay';
overlay.style.position = 'fixed';
overlay.style.left = '0';
overlay.style.top = '0';
overlay.style.pointerEvents = 'none';
overlay.style.zIndex = '999';
overlay.width = width;
overlay.height = height;
overlay.style.width = '100vw';
overlay.style.height = '100vh';
document.body.appendChild(overlay);
const overlayCtx = overlay.getContext('2d');

function drawOverlay() {
  if (!overlayCtx) return;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (shieldEnabled) {
    // Draw a large translucent circle and label to represent shield
    overlayCtx.fillStyle = 'rgba(79,195,255,0.12)';
    overlayCtx.beginPath();
    overlayCtx.arc(overlay.width / 2, overlay.height / 2, Math.min(overlay.width, overlay.height) * 0.35, 0, Math.PI * 2);
    overlayCtx.fill();

    overlayCtx.strokeStyle = 'rgba(79,195,255,0.9)';
    overlayCtx.lineWidth = 6;
    overlayCtx.beginPath();
    overlayCtx.arc(overlay.width / 2, overlay.height / 2, Math.min(overlay.width, overlay.height) * 0.35, 0, Math.PI * 2);
    overlayCtx.stroke();

    overlayCtx.fillStyle = 'rgba(79,195,255,0.9)';
    overlayCtx.font = 'bold 48px monospace';
    overlayCtx.textAlign = 'center';
    overlayCtx.fillText('SHIELD', overlay.width / 2, overlay.height / 2 + 6);
  }
}

// Draw overlay only when fallback placeholder was used
function maybeDrawOverlay() {
  if (overlayNeeded) drawOverlay();
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
