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
  const leftX = 150; const rightX = state.config.simBounds.width - 150;
  let ri = 0, bi = 0; const row = 8; const spacing = 30;
  for (const s of state.ships) {
    const i = (s.team === 'red' ? ri++ : bi++);
    const col = i % row; const r = Math.floor(i / row);
    const x = s.team === 'red' ? leftX + col * spacing : rightX - col * spacing;
    const y = 400 + r * spacing;
    s.pos.x = x; s.pos.y = y;
    s.vel.x = 0; s.vel.y = 0;
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
  ui.toggleTrails.onclick = () => { RendererConfig.enableTrails = !RendererConfig.enableTrails; ui.toggleTrails.textContent = `☄ Trails: ${RendererConfig.enableTrails ? 'On' : 'Off'}`; };
  ui.speed.onclick = () => {
    const seq = [0.5, 1, 2, 4] as const; const i = seq.indexOf(state.speedMultiplier as any);
    const next = seq[(i + 1) % seq.length]; state.speedMultiplier = next; updateSpeedLabel();
  };
  ui.seedBtn.onclick = () => { const s = `SEED-${Date.now()}`; resetState(state, s); spawnFleet(state,'red',6); spawnFleet(state,'blue',6); reFormFleets(state); updateScores(); };
  ui.formationBtn.onclick = () => { reFormFleets(state); };

  updateSpeedLabel(); updateRunLabel(); updateScores();
}

function startLoops(state: GameState, ui: UIElements) {
  const fixedDt = 1 / state.config.tickRate;
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
