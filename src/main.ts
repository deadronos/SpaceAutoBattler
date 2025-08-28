import { createInitialState, resetState, spawnFleet, spawnShip, simulateStep } from './core/gameState.js';
import type { GameState, Team, UIElements } from './types/index.js';
import { createThreeRenderer } from './renderer/threeRenderer.js';
import { RendererConfig } from './config/rendererConfig.js';
import { createPhysicsStepper } from './core/physics.js';
import { loadGLTF } from './core/assetLoader.js';

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

function randomClass(state: GameState): any { return (['fighter','corvette','frigate','destroyer','carrier'] as const)[Math.floor(state.rng.next()*5)]; }

function reFormFleets(state: GameState) {
  const leftX = 150; const rightX = state.simConfig.simBounds.width - 150;
  const centerZ = state.simConfig.simBounds.depth / 2;
  let ri = 0, bi = 0; const row = 8; const spacing = 30;
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
  state.assetPool = new Map<string, any>();

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
        } catch (e) { /* ignore missing assets */ }
      }
    } catch (e) { /* ignore */ }
  })();

  // Try to run Rapier in a worker (simWorker). If that fails, fall back to in-thread physics stepper.
  (async () => {
    try {
      // Create a module worker for simWorker.ts
      const w = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
      let ready = false;
      let lastShipData: any[] = [];
      
      w.addEventListener('message', (ev) => {
        const { type, ok, transforms } = ev.data || {};
        if (type === 'init-physics-done') {
          ready = !!ok;
        } else if (type === 'step-physics-done' && transforms) {
          // Update ship positions and velocities from physics transforms
          for (const transform of transforms) {
            const ship = state.ships.find(s => s.id === transform.shipId);
            if (ship) {
              ship.pos.x = transform.pos.x;
              ship.pos.y = transform.pos.y;
              ship.pos.z = transform.pos.z;
              ship.vel.x = transform.vel.x;
              ship.vel.y = transform.vel.y;
              ship.vel.z = transform.vel.z;
            }
          }
        }
      });
      
      w.postMessage({ type: 'init-physics' });

      // Expose a small shim for callers that expects physicsStepper API
      (state as any).physicsStepper = {
        initDone: false,
        step(dt: number) {
          try { 
            // Send current ship data to worker
            const shipData = state.ships.map(ship => ({
              id: ship.id,
              pos: { ...ship.pos },
              vel: { ...ship.vel }
            }));
            
            // Only send if ship data has changed
            const shipDataChanged = JSON.stringify(shipData) !== JSON.stringify(lastShipData);
            if (shipDataChanged) {
              w.postMessage({ type: 'update-ships', payload: { ships: shipData } });
              lastShipData = shipData;
            }
            
            // Step physics
            w.postMessage({ type: 'step-physics', payload: { dt } }); 
          } catch (e) { /* ignore */ }
        },
        dispose() { try { w.postMessage({ type: 'dispose-physics' }); } catch (e) { /* ignore */ } },
      };

      // Wait a short time for readiness, then mark initDone if ready
      setTimeout(() => { if ((state as any).physicsStepper) (state as any).physicsStepper.initDone = ready; }, 200);
    } catch (e) {
      // Fallback to in-process physics stepper
      try {
        const ps = await createPhysicsStepper(state as any);
        (state as any).physicsStepper = ps;
      } catch (ee) { /* ignore */ }
    }
  })();
  // Seeded initial fleets
  spawnFleet(state, 'red', 6);
  spawnFleet(state, 'blue', 6);
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
  ui.reset.onclick = () => { resetState(state); spawnFleet(state,'red',6); spawnFleet(state,'blue',6); reFormFleets(state); updateScores(); };
  ui.addRed.onclick = () => { spawnShip(state, 'red', randomClass(state)); };
  ui.addBlue.onclick = () => { spawnShip(state, 'blue', randomClass(state)); };
  ui.toggleTrails.onclick = () => { RendererConfig.visual.enableTrails = !RendererConfig.visual.enableTrails; ui.toggleTrails.textContent = `☄ Trails: ${RendererConfig.visual.enableTrails ? 'On' : 'Off'}`; };
  ui.speed.onclick = () => {
    const seq = [0.5, 1, 2, 4] as const; const i = seq.indexOf(state.speedMultiplier as any);
    const next = seq[(i + 1) % seq.length]; state.speedMultiplier = next; updateSpeedLabel();
  };
  ui.seedBtn.onclick = () => { const s = `SEED-${Date.now()}`; resetState(state, s); spawnFleet(state,'red',6); spawnFleet(state,'blue',6); reFormFleets(state); updateScores(); };
  ui.formationBtn.onclick = () => {
    // Clear existing ships
    state.ships = [];
    state.bullets = [];
    // Spawn randomized fleets
    const fleetSize = 8;
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
  const fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance = (maxSpread / 2) / Math.tan(fovRadians / 2) * 1.5; // 1.5x for comfortable viewing

  // Set distance with some minimum/maximum bounds
  state.renderer.cameraDistance = Math.max(300, Math.min(2000, optimalDistance));

  // Reset camera rotation to a good default viewing angle
  state.renderer.cameraRotation.x = -Math.PI / 6; // Slight downward tilt
  state.renderer.cameraRotation.y = 0; // Face the action
  state.renderer.cameraRotation.z = 0;
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
  const fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance = Math.max(fleetDistance * 1.5, 500); // Minimum distance of 500

  // Smoothly interpolate camera target
  const lerpFactor = Math.min(dt * 2, 1); // Smooth following with 2 seconds lerp time
  state.renderer.cameraTarget.x += (centerX - state.renderer.cameraTarget.x) * lerpFactor;
  state.renderer.cameraTarget.y += (centerY - state.renderer.cameraTarget.y) * lerpFactor;
  state.renderer.cameraTarget.z += (centerZ - state.renderer.cameraTarget.z) * lerpFactor;

  // Smoothly interpolate camera distance
  const distanceLerpFactor = Math.min(dt * 1, 1); // Slower distance adjustment
  state.renderer.cameraDistance += (optimalDistance - state.renderer.cameraDistance) * distanceLerpFactor;

  // Clamp distance
  state.renderer.cameraDistance = Math.max(300, Math.min(3000, state.renderer.cameraDistance));
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

    const sensitivity = 0.005;
    const deltaX = (e.clientX - lastMouseX) * sensitivity;
    const deltaY = (e.clientY - lastMouseY) * sensitivity;

    // Update camera rotation
    state.renderer.cameraRotation.y += deltaX;
    state.renderer.cameraRotation.x += deltaY;

    // Clamp vertical rotation to prevent flipping
    state.renderer.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, state.renderer.cameraRotation.x));

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Mouse wheel for zoom (move camera forward/back)
  canvas.addEventListener('wheel', (e) => {
    if (!state.renderer) return;
    e.preventDefault();

    const zoomSpeed = 50; // Fixed zoom speed
    const zoomDirection = e.deltaY > 0 ? 1 : -1; // Positive deltaY = zoom out (move back), negative = zoom in (move forward)

    // Calculate camera's forward vector
    const pitch = state.renderer.cameraRotation.x;
    const yaw = state.renderer.cameraRotation.y;
    const forwardX = Math.cos(yaw) * Math.cos(pitch);
    const forwardY = Math.sin(pitch);
    const forwardZ = Math.sin(yaw) * Math.cos(pitch);

    // Move camera and target together along forward vector
    const moveDistance = zoomSpeed * zoomDirection;
    state.renderer.cameraTarget.x += forwardX * moveDistance;
    state.renderer.cameraTarget.y += forwardY * moveDistance;
    state.renderer.cameraTarget.z += forwardZ * moveDistance;
  });

  // Keyboard controls for movement
  const keys: { [key: string]: boolean } = {};
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // Cinematic camera with 'C' key
    if (e.code === 'KeyC' && state.renderer) {
      e.preventDefault();
      isCinematicMode = true;
      resetToCinematicView(state); // Initial setup
      console.log('🎬 Cinematic camera mode activated - following both fleets');
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Update camera position based on WASD keys
  function updateCameraMovement(dt: number) {
    if (!state.renderer) return;

    const moveSpeed = 300 * dt;
    const moveVector = { x: 0, y: 0, z: 0 };

    if (keys['KeyW']) moveVector.z -= moveSpeed; // Forward
    if (keys['KeyS']) moveVector.z += moveSpeed; // Backward
    if (keys['KeyA']) moveVector.x += moveSpeed; // Left
    if (keys['KeyD']) moveVector.x -= moveSpeed; // Right
    if (keys['ShiftLeft']) moveVector.y -= moveSpeed; // Down
    if (keys['Space']) moveVector.y += moveSpeed; // Up

    // Check if any movement keys are pressed to exit cinematic mode
    const hasMovementInput = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['ShiftLeft'] || keys['Space'];
    if (hasMovementInput && isCinematicMode) {
      isCinematicMode = false;
      console.log('🎮 Manual camera control activated - cinematic mode disabled');
    }

    // If cinematic mode is active and no manual input, update cinematic camera
    if (isCinematicMode && !hasMovementInput) {
      updateCinematicCamera(state, dt);
      return; // Skip manual movement when in cinematic mode
    }

    // Calculate camera's local coordinate system
    const pitch = state.renderer.cameraRotation.x;
    const yaw = state.renderer.cameraRotation.y;

    // Forward vector (direction camera is facing)
    const forwardX = Math.cos(yaw) * Math.cos(pitch);
    const forwardY = Math.sin(pitch);
    const forwardZ = Math.sin(yaw) * Math.cos(pitch);

    // Right vector (perpendicular to forward in horizontal plane)
    const rightX = -Math.sin(yaw);
    const rightY = 0;
    const rightZ = Math.cos(yaw);

    // Up vector (perpendicular to both forward and right)
    const upX = -Math.sin(pitch) * Math.cos(yaw);
    const upY = Math.cos(pitch);
    const upZ = -Math.sin(pitch) * Math.sin(yaw);

    // Calculate movement in world space
    const worldMoveX = moveVector.x * rightX + moveVector.y * upX + moveVector.z * forwardX;
    const worldMoveY = moveVector.x * rightY + moveVector.y * upY + moveVector.z * forwardY;
    const worldMoveZ = moveVector.x * rightZ + moveVector.y * upZ + moveVector.z * forwardZ;

    // Move both camera target and position together to maintain relative orientation
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
  let fpsAccum = 0, fpsFrames = 0, fpsTime = 0;

  function frame(now: number) {
    const dt = (now - last) / 1000; last = now;
    acc += dt;
    if (state.running) {
      // Fixed-step simulation with speed multiplier
      const maxSteps = 5;
      let steps = 0;
      while (acc >= fixedDt && steps < maxSteps) {
        simulateStep(state, fixedDt * state.speedMultiplier);
        try { state.physicsStepper?.step(fixedDt * state.speedMultiplier); } catch (e) { /* ignore if missing */ }
        state.time += fixedDt * state.speedMultiplier; state.tick++;
        acc -= fixedDt; steps++;
      }
      // Auto-respawn if continuous
      if ((ui.continuous.checked)) {
        const redAlive = state.ships.some(s => s.team === 'red');
        const blueAlive = state.ships.some(s => s.team === 'blue');
        if (!redAlive) spawnFleet(state, 'red', 6);
        if (!blueAlive) spawnFleet(state, 'blue', 6);
      }
    }

    // Render
    state.renderer?.render(dt);

    // Stats
    fpsAccum += dt; fpsFrames++; fpsTime += dt;
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
window.addEventListener('DOMContentLoaded', () => initGame());
