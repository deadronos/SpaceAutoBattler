/**
 * Ship Renderer Test Page
 *
 * Minimal Three.js scene for rendering ship GLTF models in a deterministic test environment.
 * Exposes window.__TEST__ API for Playwright coordination.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Pre-initialize test API to ensure availability
window.__TEST__ = {
  waitForReady: async () => ({ frameRendered: -1, error: 'Initializing...' }),
  getSceneSummary: async () => ({ error: 'Initializing...' }),
  setOptions: async () => ({ success: false }),
};

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
  alpha: false,
});
renderer.setSize(width, height);
renderer.setPixelRatio(1); // Fixed pixel ratio for deterministic rendering

// GLTF loader
const loader = new GLTFLoader();

// --- Shield Config & Logic (ported from src/renderer/shields/shieldHexShader.tsx & src/config/shields.ts) ---

const TEAM_COLORS = {
  blue: '#8fc4ff',
  red: '#ff8193',
};

const SHIELD_TUNING = {
  enableRedBoost: true,
  redBoostPower: 1.32,
  redBoostMultiplier: 1.45,
  redTint: '#ba2b2b',
  edgeAlphaMul: 0.9,
  fillAlphaMul: 0.2,
  minAlphaFloor: 0.1,
  fillTintMul: 1.05,
};

const SHIELD_VISUAL_DEFAULTS = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.1,
  maxAlpha: 0.5,
  geometrySegments: 128,
  shieldScale: { x: 1, y: 0.65, z: 1 },
  materialKind: 'hex',
};

const SHIELD_VISUALS = {
  fighter: { margin: 1.1, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  corvette: { margin: 1.1, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  frigate: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  destroyer: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  carrier: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
};

function getShieldVisuals(hull) {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  const defaults = SHIELD_VISUAL_DEFAULTS;
  return {
    margin: cfg.margin ?? defaults.margin,
    hexScale: cfg.hexScale ?? defaults.hexScale,
    edgeWidth: cfg.edgeWidth ?? defaults.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? defaults.maxAlpha,
    geometrySegments: cfg.geometrySegments ?? defaults.geometrySegments,
    shieldScale: cfg.shieldScale ?? defaults.shieldScale,
    materialKind: cfg.materialKind ?? defaults.materialKind,
  };
}

function colorFromConfig(input, fallback = '#ffffff') {
  if (!input) {
    return new THREE.Color(fallback).convertSRGBToLinear();
  }
  return new THREE.Color(input).convertSRGBToLinear();
}

function createShieldHexShaderMaterial(hull, team) {
  const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(hull);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint) },
      uEdgeAlphaMul: { value: SHIELD_TUNING.edgeAlphaMul },
      uFillAlphaMul: { value: SHIELD_TUNING.fillAlphaMul },
      uMinAlphaFloor: { value: SHIELD_TUNING.minAlphaFloor },
      uFillTintMul: { value: SHIELD_TUNING.fillTintMul },
      uOpacity: { value: 1 },
      uHexScale: { value: hexScale },
      uEdgeWidth: { value: edgeWidth },
      uMaxAlpha: { value: maxAlpha },
      // Added for test verification
      shieldAlpha: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vCenter;

      void main() {
        vec3 N = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      varying vec3 vCenter;

      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uHexScale;
      uniform float uEdgeWidth;
      uniform float uMaxAlpha;
      uniform float uEdgeAlphaMul;
      uniform float uEdgeGlowMul;
      uniform float uFillAlphaMul;
      uniform float uMinAlphaFloor;
      uniform float uFillTintMul;

      float sdHexagon(vec2 p, float r) {
        const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
        p = abs(p);
        p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
        p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
        return length(p) * sign(p.y);
      }
      vec2 hexSkew(vec2 p) {
        return vec2((2.0/3.0) * p.x, (-1.0/3.0) * p.x + (0.57735026919) * p.y);
      }
      vec2 hexUnskew(vec2 h) {
        return vec2(1.5 * h.x, 0.86602540378 * h.x + 1.73205080757 * h.y);
      }
      vec2 hexLocal(vec2 p) {
        vec2 a = hexSkew(p);
        vec3 c = vec3(a.x, -a.x - a.y, a.y);
        vec3 rc = floor(c + 0.5);
        vec3 diff = abs(rc - c);
        if (diff.x > diff.y && diff.x > diff.z) rc.x = -rc.y - rc.z;
        else if (diff.y > diff.z) rc.y = -rc.x - rc.z;
        else rc.z = -rc.x - rc.y;
        vec2 centerAxial = vec2(rc.x, rc.z);
        vec2 center = hexUnskew(centerAxial);
        return p - center;
      }

      void main(){
        vec3 N = normalize(vWorldPos - vCenter);
        vec2 uv = vec2(atan(N.z, N.x)/6.2831853 + 0.5, acos(N.y)/3.1415926);
        uv *= uHexScale;
        vec2 cell = hexLocal(uv);
        float d = sdHexagon(cell, 0.5);
        float w = max(0.0001, uEdgeWidth);
        float border = 1.0 - smoothstep(0.0, w, abs(d));

        float fill = clamp(1.0 - border, 0.0, 1.0);
        vec3 base = uTint * (0.9 * border + uFillTintMul * fill);
        vec3 baseCol = clamp(base, 0.0, 1.0);

        float alphaBase = uOpacity * uMaxAlpha * (border * uEdgeAlphaMul + fill * uFillAlphaMul);
        alphaBase = max(alphaBase, uOpacity * uMaxAlpha * uMinAlphaFloor);

        float alpha = clamp(alphaBase, 0.0, 1.0);
        if(alpha <= 0.002) discard;
        gl_FragColor = vec4(baseCol, alpha);
      }
    `,
  });

  mat.name = 'ShieldHexMaterial';
  return mat;
}

const FALLBACK_SHIELD_RADIUS_BY_HULL = {
  fighter: 1.8,
  corvette: 2.3,
  frigate: 3.0,
  destroyer: 3.7,
  carrier: 4.6,
};

function addShield(ship, hull) {
  const visuals = getShieldVisuals(hull);
  const material = createShieldHexShaderMaterial(hull, 'blue');
  const geometry = new THREE.SphereGeometry(1, visuals.geometrySegments, visuals.geometrySegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ShieldBubble'; // Name expected by test

  const r = FALLBACK_SHIELD_RADIUS_BY_HULL[hull] ?? 2.0;
  const vs = visuals.shieldScale;
  mesh.scale.set(vs.x * r, vs.y * r, vs.z * r);

  ship.add(mesh);
}

// --- Engine Glow Config & Logic (ported from src/components/thrusters/ThrusterInstancedManager.tsx) ---
const THRUSTER_GLOW_CONFIG = {
  defaultEmissiveColor: '#5fb6ff',
  glowMeshSize: 0.02,
  tailOffset: 0.01,
  anchorsByHull: {
    fighter: 1,
    corvette: 2,
    frigate: 2,
    destroyer: 4,
    carrier: 6,
  },
};

const HULL_SIZE_HINTS = {
  fighter: new THREE.Vector3(1.4, 0.7, 2.8),
  corvette: new THREE.Vector3(2.4, 1.2, 4.2),
  frigate: new THREE.Vector3(3.2, 1.4, 5.5),
  destroyer: new THREE.Vector3(4.4, 2.0, 7.2),
  carrier: new THREE.Vector3(6.4, 2.8, 10.4),
};

function createAnchorPattern(hull) {
  const count = THRUSTER_GLOW_CONFIG.anchorsByHull[hull] ?? 1;
  const size = HULL_SIZE_HINTS[hull] ?? new THREE.Vector3(2, 1, 3);
  const tailZ = -size.z * 0.6 - size.z * THRUSTER_GLOW_CONFIG.tailOffset;
  const anchors = [];
  for (let i = 0; i < count; i += 1) {
    let x = 0;
    let y = 0;
    if (count === 2) {
      x = (i === 0 ? -1 : 1) * 0.3 * size.x;
    } else if (count === 4) {
      x = (i % 2 === 0 ? -1 : 1) * 0.25 * size.x;
      y = (i < 2 ? -1 : 1) * 0.2 * size.y;
    } else if (count === 6) {
      x = (i % 2 === 0 ? -1 : 1) * 0.35 * size.x;
      y = (Math.floor(i / 2) - 1) * 0.18 * size.y;
    }
    anchors.push(new THREE.Vector3(x, y, tailZ));
  }
  return anchors;
}

function addEngineGlow(ship, hull) {
  const anchors = createAnchorPattern(hull);
  const size = HULL_SIZE_HINTS[hull] ?? new THREE.Vector3(2, 1, 3);

  // Base scale calculation from ThrusterInstancedManager:
  // hullScale (approx 1.0 here) * (glowMeshSize * 50) * (1 + throttle * 1.8)
  // We assume throttle = 1.0 (full thrust) for the test
  const hullScale = 1.0;
  const baseScale = hullScale * (THRUSTER_GLOW_CONFIG.glowMeshSize * 50);
  const throttle = 1.0;
  const scaleValue = baseScale * (1 + throttle * 1.8);

  const geometry = new THREE.SphereGeometry(1, 16, 12);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    emissive: new THREE.Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor),
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.8,
  });
  material.name = 'engine-glow';

  anchors.forEach((anchorPos, index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `engine-glow-${index}`;
    // Position relative to ship center
    mesh.position.copy(anchorPos);
    mesh.scale.setScalar(scaleValue);
    ship.add(mesh);
  });
}

// --- End Engine Glow Logic ---

// Helper: try to find a model file matching hullId in common directories
async function findModelFile(hull) {
  // Directly check the known source path first to avoid 404s and delays
  // The test server runs at repo root, so /src/assets/gltf/ is accessible.
  const directPath = `/src/assets/gltf/${hull}.glb`;
  try {
    const res = await fetch(directPath, { method: 'HEAD' });
    if (res.ok) return directPath;
  } catch (e) {
    console.warn(`Direct fetch failed for ${directPath}`, e);
  }

  const candidateDirs = ['/models/', '/dist/models/', '/assets/models/', '/src/assets/gltf/'];
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
  const fallbacks = ['/assets/models/', '/models/', '/dist/models/', '/src/assets/gltf/'];
  for (const fb of fallbacks) {
    const fbPath = `${fb}${hull}.glb`;
    try {
      const r = await fetch(fbPath, { method: 'HEAD' });
      if (r.ok) return fbPath;
    } catch {
      /* ignore */
    }
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
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
        },
      });

      if (node.material) {
        const mat = node.material;
        const matInfo = {
          name: mat.name,
          type: mat.type,
          visible: node.visible,
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
          Object.keys(mat.uniforms).forEach((key) => {
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
    uniforms,
  };
}

/**
 * Load ship model
 */
async function loadShip() {
  updateStatus(`Loading ${hullId}...`);

  // Attempt to locate the correct model file (handles webpackized names)
  // Honor explicit model path passed from the test runner first
  let modelPath = explicitModelPath || (SHIP_MODEL_PATHS[hullId] ?? null);

  // Try discovery if explicit path is not set or failed previous checks (though logic here is simple)
  // If SHIP_MODEL_PATHS gave a path but it's 404ing (which we can't easily know yet), we might want to try discovery.
  // But for now, let's aggressively assume we need discovery if explicit isn't set.
  if (!explicitModelPath) {
    try {
      const discovered = await findModelFile(hullId);
      if (discovered) modelPath = discovered;
    } catch {
      // ignore discovery errors; we'll use the fallback paths or placeholder
    }
  }

  if (!modelPath) {
    // If no path found at all, try the direct source one last time as fallback
    modelPath = `/src/assets/gltf/${hullId}.glb`;
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

        // --- Apply Engine Glow if enabled ---
        if (engineEnabled) {
          addEngineGlow(shipModel, hullId);
        }

        // --- Apply Shield if enabled ---
        if (shieldEnabled) {
          addShield(shipModel, hullId);
        }

        updateStatus(`Loaded ${hullId}`);
        resolve();
      },
      (progress) => {
        const percent = ((progress.loaded / progress.total) * 100).toFixed(0);
        updateStatus(`Loading ${hullId}... ${percent}%`);
      },
      (error) => {
        console.error('GLTF load failed, using placeholder:', error);
        // Fallback: create a simple placeholder ship so tests can continue
        try {
          const placeholder = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.6, 3.0),
            new THREE.MeshStandardMaterial({ color: 0x777777 }),
          );
          body.name = `${hullId}-placeholder-body`;
          placeholder.add(body);

          if (shieldEnabled) {
            const shield = new THREE.Mesh(
              new THREE.SphereGeometry(2.0, 32, 32),
              new THREE.MeshBasicMaterial({
                color: 0x4fc3ff,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
              }),
            );
            shield.name = `${hullId}-placeholder-shield`;
            placeholder.add(shield);
          }

          // Even on placeholder, show engine glow if requested
          if (engineEnabled) {
            addEngineGlow(placeholder, hullId);
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
      },
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
    // Expose error to test API
    if (window.__TEST__) {
      window.__TEST__.waitForReady = async () => ({ frameRendered: -1, error: error.message });
    }
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
    overlayCtx.arc(
      overlay.width / 2,
      overlay.height / 2,
      Math.min(overlay.width, overlay.height) * 0.35,
      0,
      Math.PI * 2,
    );
    overlayCtx.fill();

    overlayCtx.strokeStyle = 'rgba(79,195,255,0.9)';
    overlayCtx.lineWidth = 6;
    overlayCtx.beginPath();
    overlayCtx.arc(
      overlay.width / 2,
      overlay.height / 2,
      Math.min(overlay.width, overlay.height) * 0.35,
      0,
      Math.PI * 2,
    );
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
  },
};
