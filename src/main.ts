import { createInitialState, resetState, spawnFleet, spawnShip, simulateStep } from './core/gameState.js';
// Ensure low-level GL/readPixels patches are applied as early as possible
// so prototype wrappers and GL instrumentation are present before any
// renderer instances are created by other modules.
import { applyGlobalPatches } from './renderer/effects.js';

try { applyGlobalPatches(); } catch (_e) { void _e;/* ignore */ }
import * as THREE from 'three';

// Expose canonical Three.js runtime to globalThis so modules using different
// bundling/resolution still reference the same constructors at runtime.
// This mitigates "Multiple instances of Three.js being imported" issues
// which can break attribute/constructor identity used by the renderer.
// Keep this as early as possible in the bootstrap sequence.
/* eslint-disable no-void */
/* global globalThis */
if (!(globalThis as any).THREE) {
  (globalThis as any).THREE = THREE;
}
import type { GameState, UIElements, ShipClass } from './types/index.js';
import { createThreeRenderer } from './renderer/threeRenderer.js';
import { RendererConfig } from './config/rendererConfig.js';
import { createPhysicsStepper } from './core/physics.js';
import { loadGLTF } from './core/assetLoader.js';
import { CameraConfig } from './config/cameraConfig.js';
import { FleetConfig } from './config/fleetConfig.js';
// DefaultSimConfig not used here; keep config imports minimal to avoid unused-import ESLint errors
import { getSVGLoader, loadSVGAsset } from './core/svgLoader.js';
import * as logger from './utils/logger.js';
import { DefaultGameConfig } from './config/gameConfig.js';
import { defaultSVGConfig, getShipSVGUrls } from './config/svgConfig.js';

function $(id: string) { return document.getElementById(id)!; }

function bindUI(): UIElements {
  return {
    canvas: document.getElementById('world') as HTMLCanvasElement,
    startPause: $('startPause') as HTMLButtonElement,
    reset: $('reset') as HTMLButtonElement,
    addRed: $('addRed') as HTMLButtonElement,
    addBlue: $('addBlue') as HTMLButtonElement,
    toggleTrails: $('toggleTrails') as HTMLButtonElement,
    speed: $('speed') as HTMLDivElement,
    redScore: $('redScore') as HTMLDivElement,
    blueScore: $('blueScore') as HTMLDivElement,
    stats: $('stats') as HTMLDivElement,
    continuous: $('continuousCheckbox') as HTMLInputElement,
    seedBtn: $('seedBtn') as HTMLButtonElement,
    formationBtn: $('formationBtn') as HTMLButtonElement,
  };
}

function randomClass(state: GameState): ShipClass { return (['fighter','corvette','frigate','destroyer','carrier'] as const as ShipClass[])[Math.floor(state.rng.next()*5)]; }

function reFormFleets(state: GameState) {
  const leftX = FleetConfig.positioning.leftMargin;
  const rightX = state.simConfig.simBounds.width - FleetConfig.positioning.rightMargin;
  const centerZ = state.simConfig.simBounds.depth / 2 + FleetConfig.positioning.centerZOffset;
  let ri = 0, bi = 0;
  const row = FleetConfig.positioning.rowSize;
  const spacing = FleetConfig.positioning.spacing;
  for (const s of state.ships) {
    const i = (s.team === 'red' ? ri++ : bi++);
    const col = i % row; const r = Math.floor(i / row);
    const x = s.team === 'red' ? leftX + col * spacing : rightX - col * spacing;
    const y = 400 + r * spacing;
    const z = centerZ + (state.rng.next() - 0.5) * 100; // Random z position around center
    s.pos.x = x; s.pos.y = y; s.pos.z = z;
    s.vel.x = 0; s.vel.y = 0; s.vel.z = 0;
  }
}

function initGame(seed?: string) {
  const ui = bindUI();
  const state = createInitialState(seed);
  // Ensure there is an asset pool for GLTFs and textures
  state.assetPool = new Map<string, unknown>();

  // Initialize SVG loader and preload ship SVGs
  const svgLoader = getSVGLoader();
  const shipSVGUrls = getShipSVGUrls(defaultSVGConfig);

  // Preload SVG assets with change detection enabled
  (async () => {
    try {
      logger.debug('[main.ts] Preloading SVG assets with change detection...');

      for (const svgUrl of shipSVGUrls) {
        try {
          // Load SVG with rasterization
          const asset = await loadSVGAsset(svgUrl, {
            width: defaultSVGConfig.defaultRasterSize.width,
            height: defaultSVGConfig.defaultRasterSize.height,
            enableWatching: defaultSVGConfig.cache.enableFileWatching
          });

          // Store in asset pool for renderer access
          state.assetPool!.set(svgUrl, asset);

          logger.debug(`[main.ts] Loaded SVG asset: ${svgUrl}`);
        } catch (_error) { void _error;logger.warn(`[main.ts] Failed to load SVG asset ${svgUrl}:`, _error);
        }
      }

      logger.debug('[main.ts] SVG asset preloading complete');
      } catch (_error) { void _error;logger.error('[main.ts] Error during SVG asset preloading:', _error);
    }
  })();
  (window as any).debugSVG = {
    // Get SVG loader stats
    getStats: () => {
      const stats = svgLoader.getCacheStats();
      logger.debug('[SVG Debug] Cache stats:', stats);
      return stats;
    },

    // Manually reload all SVG assets
    reloadAll: async () => {
      logger.debug('[SVG Debug] Manually reloading all SVG assets...');
      try {
        await svgLoader.reloadAllAssets();
        logger.debug('[SVG Debug] All SVG assets reloaded successfully');
      } catch (_error) { void _error;logger.error('[SVG Debug] Failed to reload SVG assets:', _error);
      }
    },

    // Clear SVG cache
    clearCache: (assetUrl?: string) => {
      logger.debug('[SVG Debug] Clearing SVG cache...', assetUrl ? `for ${assetUrl}` : 'all assets');
      svgLoader.clearCache(assetUrl);
      logger.debug('[SVG Debug] SVG cache cleared');
    },

    // List cached assets
    listCached: () => {
      const assets = Array.from(svgLoader.getCacheStats().cachedAssets > 0 ? 'assets cached' : []);
      logger.debug('[SVG Debug] Cached SVG assets:', assets);
      return assets;
    }
  };

  logger.debug('[main.ts] SVG debugging functions available at window.debugSVG');
  logger.debug('[main.ts] Use debugSVG.getStats(), debugSVG.reloadAll(), debugSVG.clearCache(), debugSVG.listCached()');

  // Optionally preload common ship assets into the pool (config-driven)
  (async () => {
    try {
      const classes: string[] = ['fighter','corvette','frigate','destroyer','carrier'];
      for (const cls of classes) {
        const url = `/assets/models/ship-${cls}.gltf`;
        // Attempt to load; if not present, loader will fail silently
        try {
          const res = await loadGLTF(state, url);
          if (state.assetPool) {
            state.assetPool.set(`ship-${cls}-red`, res);
            state.assetPool.set(`ship-${cls}-blue`, res);
          }
        } catch (_e) { void _e;/* ignore missing assets */ }
      }
    } catch (_e) { void _e;/* ignore */ }
  })();

  // Try to run Rapier in a worker (simWorker). If that fails, fall back to in-thread physics stepper.
  (async () => {
    try {
      // Create a module worker for simWorker.ts
      const w = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
      let ready = false;
      let lastShipDataVersion = -1;
      
      w.addEventListener('message', (ev) => {
        const data = ev.data || {};
        const type = data.type;
        // init handshake
        if (type === 'init-physics-done') {
          ready = !!data.ok;
          return;
        }

        // step result: supports packed Float32Array buffer (transformsBuffer)
        if (type === 'step-physics-done') {
          // Prefer transferable typed-array buffer payload for low-overhead transfer
          const buf = data.transformsBuffer || (data.transforms && data.transforms.buffer) || null;
          if (buf) {
            try {
              const arr = new Float32Array(buf);
              // Each entry is [id, px, py, pz, vx, vy, vz]
              for (let i = 0; i < arr.length; i += 7) {
                const id = Math.floor(arr[i]);
                const ship = state.shipIndex?.get(id) ?? state.ships.find(s => s.id === id);
                if (!ship) continue;
                ship.pos.x = arr[i + 1]; ship.pos.y = arr[i + 2]; ship.pos.z = arr[i + 3];
                ship.vel.x = arr[i + 4]; ship.vel.y = arr[i + 5]; ship.vel.z = arr[i + 6];
              }
            } catch (_e) { void _e;// Fallback to older object-based transforms if parsing fails
              const transforms = data.transforms || [];
              for (const transform of transforms) {
                const ship = state.shipIndex?.get(transform.shipId) ?? state.ships.find(s => s.id === transform.shipId);
                if (ship) {
                  ship.pos.x = transform.pos.x; ship.pos.y = transform.pos.y; ship.pos.z = transform.pos.z;
                  ship.vel.x = transform.vel.x; ship.vel.y = transform.vel.y; ship.vel.z = transform.vel.z;
                }
              }
            }
          } else if (data.transforms) {
            // Legacy: array of objects
            for (const transform of data.transforms) {
              const ship = state.shipIndex?.get(transform.shipId) ?? state.ships.find(s => s.id === transform.shipId);
              if (ship) {
                ship.pos.x = transform.pos.x; ship.pos.y = transform.pos.y; ship.pos.z = transform.pos.z;
                ship.vel.x = transform.vel.x; ship.vel.y = transform.vel.y; ship.vel.z = transform.vel.z;
              }
            }
          }
          return;
        }
      });
      
      w.postMessage({ type: 'init-physics' });

      // Expose a small shim for callers that expects physicsStepper API
      (state as any).physicsStepper = {
        initDone: false,
        step(dt: number) {
          try { 
            // Send current ship data to worker only if it has changed
            const currentVersion = state.shipDataVersion;
            if (currentVersion !== lastShipDataVersion) {
              const shipData = state.ships.map(ship => ({
                id: ship.id,
                pos: { ...ship.pos },
                vel: { ...ship.vel }
              }));
              w.postMessage({ type: 'update-ships', payload: { ships: shipData } });
              lastShipDataVersion = currentVersion;
            }
            
            // Step physics
            w.postMessage({ type: 'step-physics', payload: { dt } }); 
          } catch (_e) { void _e;/* ignore */ }
        },
        dispose() { try { w.postMessage({ type: 'dispose-physics' }); } catch (_e) { void _e;/* ignore */ } },
      };

      // Wait a short time for readiness, then mark initDone if ready
      setTimeout(() => { if ((state as any).physicsStepper) (state as any).physicsStepper.initDone = ready; }, 200);
    } catch (_e) { void _e;// Fallback to in-process physics stepper
      try {
        const ps = await createPhysicsStepper(state as any);
        (state as any).physicsStepper = ps;
      } catch (ee) { void ee;/* ignore */ }
    }
  })();
  // Seeded initial fleets
  spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
  spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
  reFormFleets(state);
  const renderer = createThreeRenderer(state, ui.canvas);
  state.renderer = renderer;
  wireControls(state, ui);
  setupCameraControls(state, ui.canvas);
  startLoops(state, ui);
}

function wireControls(state: GameState, ui: UIElements) {
  function updateSpeedLabel() { ui.speed.textContent = `Speed: ${state.speedMultiplier}×`; }
  function updateRunLabel() { ui.startPause.textContent = state.running ? '⏸ Pause' : '▶ Start'; }
  function updateScores() { ui.redScore.textContent = `Red ${state.score.red}`; ui.blueScore.textContent = `Blue ${state.score.blue}`; }

  ui.startPause.onclick = () => { state.running = !state.running; updateRunLabel(); };
  ui.reset.onclick = () => { resetState(state); spawnFleet(state,'red', FleetConfig.spawning.defaultFleetSize); spawnFleet(state,'blue', FleetConfig.spawning.defaultFleetSize); reFormFleets(state); updateScores(); };
  ui.addRed.onclick = () => { spawnShip(state, 'red', randomClass(state)); };
  ui.addBlue.onclick = () => { spawnShip(state, 'blue', randomClass(state)); };
  ui.toggleTrails.onclick = () => { RendererConfig.visual.enableTrails = !RendererConfig.visual.enableTrails; ui.toggleTrails.textContent = `☄ Trails: ${RendererConfig.visual.enableTrails ? 'On' : 'Off'}`; };
  ui.speed.onclick = () => {
    const seq = [0.5, 1, 2, 4] as const; const i = seq.indexOf(state.speedMultiplier as any);
    const next = seq[(i + 1) % seq.length]; state.speedMultiplier = next; updateSpeedLabel();
  };
  ui.seedBtn.onclick = () => { const s = `SEED-${Date.now()}`; resetState(state, s); spawnFleet(state,'red', FleetConfig.spawning.defaultFleetSize); spawnFleet(state,'blue', FleetConfig.spawning.defaultFleetSize); reFormFleets(state); updateScores(); };
  ui.formationBtn.onclick = () => {
    // Clear existing ships
    state.ships = [];
    state.bullets = [];
    // Spawn randomized fleets
    const fleetSize = FleetConfig.spawning.defaultFleetSize;
    for (let i = 0; i < fleetSize; i++) {
      const redClass = randomClass(state);
      const blueClass = randomClass(state);
      spawnShip(state, 'red', redClass);
      spawnShip(state, 'blue', blueClass);
    }
    updateScores();
  };

  updateSpeedLabel(); updateRunLabel(); updateScores();
}

function resetToCinematicView(state: GameState) {
  if (!state.renderer || state.ships.length === 0) return;

  // Calculate center of mass of all alive ships
  let centerX = 0, centerY = 0, centerZ = 0;
  let shipCount = 0;

  for (const ship of state.ships) {
    if (ship.health > 0) { // Only count alive ships
      centerX += ship.pos.x;
      centerY += ship.pos.y;
      centerZ += ship.pos.z;
      shipCount++;
    }
  }

  if (shipCount === 0) return;

  centerX /= shipCount;
  centerY /= shipCount;
  centerZ /= shipCount;

  // Calculate the spread (bounding box) of ships to determine optimal zoom
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const ship of state.ships) {
    if (ship.health > 0) {
      minX = Math.min(minX, ship.pos.x);
      maxX = Math.max(maxX, ship.pos.x);
      minY = Math.min(minY, ship.pos.y);
      maxY = Math.max(maxY, ship.pos.y);
      minZ = Math.min(minZ, ship.pos.z);
      maxZ = Math.max(maxZ, ship.pos.z);
    }
  }

  // Calculate dimensions of the ship cluster
  const spreadX = maxX - minX;
  const spreadY = maxY - minY;
  const spreadZ = maxZ - minZ;
  const maxSpread = Math.max(spreadX, spreadY, spreadZ);

  // Set camera target to center of mass
  state.renderer.cameraTarget.x = centerX;
  state.renderer.cameraTarget.y = centerY;
  state.renderer.cameraTarget.z = centerZ;

  // Calculate optimal distance based on spread and camera FOV
  const _fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance = (maxSpread / 2) / Math.tan(_fovRadians / 2) * CameraConfig.resetToCinematic.fovMultiplier; // 1.5x for comfortable viewing

  // Set distance with some minimum/maximum bounds
  state.renderer.cameraDistance = Math.max(CameraConfig.cinematic.minDistance, Math.min(CameraConfig.cinematic.maxDistance, optimalDistance));

  // Reset camera rotation to a good default viewing angle
  state.renderer.cameraRotation.x = CameraConfig.resetToCinematic.cameraRotation.x; // Slight downward tilt
  state.renderer.cameraRotation.y = CameraConfig.resetToCinematic.cameraRotation.y; // Face the action
  state.renderer.cameraRotation.z = CameraConfig.resetToCinematic.cameraRotation.z;
}

function updateCinematicCamera(state: GameState, dt: number) {
  if (!state.renderer || state.ships.length === 0) return;

  // Separate ships by team
  const redShips = state.ships.filter(s => s.team === 'red' && s.health > 0);
  const blueShips = state.ships.filter(s => s.team === 'blue' && s.health > 0);

  if (redShips.length === 0 || blueShips.length === 0) return;

  // Calculate center of each fleet
  let redCenterX = 0, redCenterY = 0, redCenterZ = 0;
  let blueCenterX = 0, blueCenterY = 0, blueCenterZ = 0;

  for (const ship of redShips) {
    redCenterX += ship.pos.x;
    redCenterY += ship.pos.y;
    redCenterZ += ship.pos.z;
  }
  redCenterX /= redShips.length;
  redCenterY /= redShips.length;
  redCenterZ /= redShips.length;

  for (const ship of blueShips) {
    blueCenterX += ship.pos.x;
    blueCenterY += ship.pos.y;
    blueCenterZ += ship.pos.z;
  }
  blueCenterX /= blueShips.length;
  blueCenterY /= blueShips.length;
  blueCenterZ /= blueShips.length;

  // Calculate the midpoint between both fleets
  const centerX = (redCenterX + blueCenterX) / 2;
  const centerY = (redCenterY + blueCenterY) / 2;
  const centerZ = (redCenterZ + blueCenterZ) / 2;

  // Calculate distance between fleets for optimal zoom
  const fleetDistance = Math.sqrt(
    Math.pow(redCenterX - blueCenterX, 2) +
    Math.pow(redCenterY - blueCenterY, 2) +
    Math.pow(redCenterZ - blueCenterZ, 2)
  );

  // Calculate optimal camera distance (show both fleets with some margin)
  const _fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance = Math.max(fleetDistance * CameraConfig.cinematic.fleetDistanceMultiplier, CameraConfig.cinematic.minDistance); // Minimum distance of 500

  // Smoothly interpolate camera target
  const lerpFactor = Math.min(dt * CameraConfig.cinematic.lerpFactor, 1); // Smooth following with 2 seconds lerp time
  state.renderer.cameraTarget.x += (centerX - state.renderer.cameraTarget.x) * lerpFactor;
  state.renderer.cameraTarget.y += (centerY - state.renderer.cameraTarget.y) * lerpFactor;
  state.renderer.cameraTarget.z += (centerZ - state.renderer.cameraTarget.z) * lerpFactor;

  // Smoothly interpolate camera distance
  const distanceLerpFactor = Math.min(dt * CameraConfig.cinematic.distanceLerpFactor, 1); // Slower distance adjustment
  state.renderer.cameraDistance += (optimalDistance - state.renderer.cameraDistance) * distanceLerpFactor;

  // Clamp distance
  state.renderer.cameraDistance = Math.max(CameraConfig.cinematic.minDistance, Math.min(CameraConfig.cinematic.maxDistance, state.renderer.cameraDistance));
}

function setupCameraControls(state: GameState, canvas: HTMLCanvasElement) {
  if (!state.renderer) return;

  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let isCinematicMode = false;

  // Mouse controls for rotation (click and drag)
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !state.renderer) return;

    const sensitivity = CameraConfig.controls.mouseSensitivity;
    const deltaX = (e.clientX - lastMouseX) * sensitivity;
    const deltaY = (e.clientY - lastMouseY) * sensitivity;

    // Update camera rotation
    // Orbit controls: yaw left/right with horizontal drag; pitch up/down with vertical drag
    // Note: invert Y so dragging up rotates camera up (natural control)
    state.renderer.cameraRotation.y -= deltaX;
    state.renderer.cameraRotation.x -= deltaY;

    // Clamp vertical rotation to prevent flipping
  const pitchLimit = (Math.PI / 2) - 0.001;
  state.renderer.cameraRotation.x = Math.max(-pitchLimit, Math.min(pitchLimit, state.renderer.cameraRotation.x));
  // Keep yaw within [-PI, PI] to avoid numerical drift
  if (state.renderer.cameraRotation.y > Math.PI) state.renderer.cameraRotation.y -= Math.PI * 2;
  if (state.renderer.cameraRotation.y < -Math.PI) state.renderer.cameraRotation.y += Math.PI * 2;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Mouse wheel for zoom (move camera forward/back)
  canvas.addEventListener('wheel', (e) => {
    if (!state.renderer) return;
    e.preventDefault();

    const zoomSpeed = CameraConfig.controls.zoomSpeed; // Fixed zoom speed
  const zoomDirection = e.deltaY > 0 ? 1 : -1; // Positive deltaY = zoom out (move back), negative = zoom in (move forward)

    // Calculate camera's forward vector
    const pitch = state.renderer.cameraRotation.x;
    const yaw = state.renderer.cameraRotation.y;
    const forwardX = Math.cos(yaw) * Math.cos(pitch);
    const forwardY = Math.sin(pitch);
    const forwardZ = Math.sin(yaw) * Math.cos(pitch);

  // Move camera and target together along forward vector
  const moveDistance = zoomSpeed * zoomDirection;
  // Use camera forward as direction; positive zoomDirection moves outward
  state.renderer.cameraTarget.x += forwardX * moveDistance;
  state.renderer.cameraTarget.y += forwardY * moveDistance;
  state.renderer.cameraTarget.z += forwardZ * moveDistance;
  });

  // Keyboard controls for movement
  const keys: { [key: string]: boolean } = {};
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // Prevent browser defaults on movement keys (e.g., Space scrolling)
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ShiftLeft' || e.code === 'Space') {
      e.preventDefault();
    }

    // Cinematic camera with 'C' key
    if (e.code === 'KeyC' && state.renderer) {
      e.preventDefault();
      isCinematicMode = true;
      resetToCinematicView(state); // Initial setup
      logger.info('🎬 Cinematic camera mode activated - following both fleets');
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Update camera position based on WASD keys
  function updateCameraMovement(dt: number) {
    if (!state.renderer) return;

    const moveSpeed = CameraConfig.controls.moveSpeed * dt;
    let moveForward = 0, moveRight = 0, moveUp = 0;
  // W should move the camera forward (toward where the camera is looking).
  if (keys['KeyW']) moveForward += moveSpeed;   // Forward (towards forward vector)
  if (keys['KeyS']) moveForward -= moveSpeed;   // Backward
    if (keys['KeyD']) moveRight   += moveSpeed;   // Right
    if (keys['KeyA']) moveRight   -= moveSpeed;   // Left
    if (keys['Space']) moveUp     += moveSpeed;   // Up
    if (keys['ShiftLeft']) moveUp -= moveSpeed;   // Down

    // Check if any movement keys are pressed to exit cinematic mode
    const hasMovementInput = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['ShiftLeft'] || keys['Space'];
    if (hasMovementInput && isCinematicMode) {
      isCinematicMode = false;
      logger.info('🎮 Manual camera control activated - cinematic mode disabled');
    }

    // If cinematic mode is active and no manual input, update cinematic camera
    if (isCinematicMode && !hasMovementInput) {
      updateCinematicCamera(state, dt);
      return; // Skip manual movement when in cinematic mode
    }

    // Build an orthonormal basis from yaw/pitch to avoid warped motion
    const pitch = state.renderer.cameraRotation.x;
    const yaw = state.renderer.cameraRotation.y;
    // Forward (where camera looks)
    let fx = Math.cos(yaw) * Math.cos(pitch);
    let fy = Math.sin(pitch);
    let fz = Math.sin(yaw) * Math.cos(pitch);
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
  // The spherical coords above describe the camera position offset from the target.
  // The camera's forward vector (where it looks) points from the camera into the scene -
  // i.e., from camera position toward the target, which is the negative of the offset.
  // Negate to align with THREE.Camera.getWorldDirection and other codepaths.
  fx = -fx; fy = -fy; fz = -fz;

    // Right = normalize(cross(forward, worldUp))
    const upWorldX = 0, upWorldY = 1, upWorldZ = 0;
    let rx = fy * upWorldZ - fz * upWorldY; // fy*0 - fz*1 = -fz
    let ry = fz * upWorldX - fx * upWorldZ; // fz*0 - fx*0 = 0
    let rz = fx * upWorldY - fy * upWorldX; // fx*1 - fy*0 = fx
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;

    // Up (camera-up) = normalize(cross(right, forward))
    let ux = ry * fz - rz * fy;
    let uy = rz * fx - rx * fz;
    let uz = rx * fy - ry * fx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;

  // Compose movement in world space: forward is along camera forward vector
  const worldMoveX = moveRight * rx + moveUp * upWorldX + moveForward * fx;
  const worldMoveY = moveRight * ry + moveUp * upWorldY + moveForward * fy;
  const worldMoveZ = moveRight * rz + moveUp * upWorldZ + moveForward * fz;

    state.renderer.cameraTarget.x += worldMoveX;
    state.renderer.cameraTarget.y += worldMoveY;
    state.renderer.cameraTarget.z += worldMoveZ;
  }

  // Add camera movement to the render loop
  const originalRender = state.renderer.render;
  state.renderer.render = function(dt: number) {
    updateCameraMovement(dt);
    originalRender.call(state.renderer, dt);
  };
}

function startLoops(state: GameState, ui: UIElements) {
  const fixedDt = 1 / state.simConfig.tickRate;
  let last = performance.now();
  let acc = 0;
  let fpsAccum = 0, fpsFrames = 0, _fpsTime = 0;

  function frame(now: number) {
    const dt = (now - last) / 1000; last = now;
    acc += dt;
    if (state.running) {
      // Fixed-step simulation with speed multiplier
      const maxSteps = 5;
      let steps = 0;
      while (acc >= fixedDt && steps < maxSteps) {
        simulateStep(state, fixedDt * state.speedMultiplier);
        try { state.physicsStepper?.step(fixedDt * state.speedMultiplier); } catch (_e) { void _e;/* ignore if missing */ }
        state.time += fixedDt * state.speedMultiplier; state.tick++;
        acc -= fixedDt; steps++;
      }
      // Auto-respawn if continuous
      if ((ui.continuous.checked)) {
        const redAlive = state.ships.some(s => s.team === 'red');
        const blueAlive = state.ships.some(s => s.team === 'blue');
        if (!redAlive) spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
        if (!blueAlive) spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
      }
    }

    // Render
    state.renderer?.render(dt);

    // Stats
  fpsAccum += dt; fpsFrames++; _fpsTime += dt;
    if (fpsAccum >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAccum);
      ui.stats.textContent = `FPS ${fps} • Ships ${state.ships.length} • Bullets ${state.bullets.length} • Tick ${state.tick}`;
      // Update scoreboard periodically
      (document.getElementById('redScore') as HTMLDivElement).textContent = `Red ${state.score.red}`;
      (document.getElementById('blueScore') as HTMLDivElement).textContent = `Blue ${state.score.blue}`;
      fpsAccum = 0; fpsFrames = 0;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Boot
// Initialize logger debug mode from global game config so devs can toggle verbosity
logger.setDebug(!!DefaultGameConfig.ui.showDebugInfo);

window.addEventListener('DOMContentLoaded', () => initGame());


