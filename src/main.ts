import { createInitialState, resetState, spawnFleet, spawnShip, simulateStep } from './core/gameState.js';
import type { GameState, Team, UIElements } from './types/index.js';
import { createThreeRenderer } from './renderer/threeRenderer.js';
import { RendererConfig } from './config/rendererConfig.js';

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

function setupCameraControls(state: GameState, canvas: HTMLCanvasElement) {
  if (!state.renderer) return;

  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

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

  // Mouse wheel for zoom
  canvas.addEventListener('wheel', (e) => {
    if (!state.renderer) return;
    e.preventDefault();

    const zoomSpeed = 50;
    state.renderer.cameraDistance += e.deltaY > 0 ? zoomSpeed : -zoomSpeed;

    // Clamp zoom distance
    state.renderer.cameraDistance = Math.max(200, Math.min(2000, state.renderer.cameraDistance));
  });

  // Keyboard controls for movement
  const keys: { [key: string]: boolean } = {};
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Update camera position based on WASD keys
  function updateCameraMovement(dt: number) {
    if (!state.renderer) return;

    const moveSpeed = 300 * dt;
    const moveVector = { x: 0, y: 0, z: 0 };

    if (keys['KeyW']) moveVector.z -= moveSpeed;
    if (keys['KeyS']) moveVector.z += moveSpeed;
    if (keys['KeyA']) moveVector.x -= moveSpeed;
    if (keys['KeyD']) moveVector.x += moveSpeed;
    if (keys['ShiftLeft']) moveVector.y -= moveSpeed;
    if (keys['Space']) moveVector.y += moveSpeed;

    // Apply movement relative to camera orientation
    const cosY = Math.cos(state.renderer.cameraRotation.y);
    const sinY = Math.sin(state.renderer.cameraRotation.y);

    state.renderer.cameraTarget.x += moveVector.x * cosY - moveVector.z * sinY;
    state.renderer.cameraTarget.z += moveVector.x * sinY + moveVector.z * cosY;
    state.renderer.cameraTarget.y += moveVector.y;
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
