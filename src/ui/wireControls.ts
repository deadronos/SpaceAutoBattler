import type { GameState, UIElements } from '../types/index.js';
import { resetState, spawnFleet, spawnShip } from '../core/gameState.js';
import { reFormFleets } from '../core/reFormFleets.js';
import { randomClass } from '../utils/randomShipClass.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { FleetConfig } from '../config/fleetConfig.js';

export function wireControls(state: GameState, ui: UIElements): void {
  // Defensive guard: in test environments the UI may not be present.
  // If key elements are missing, skip attaching DOM handlers to avoid
  // unhandled exceptions (tests run in JSDOM or headless environments).
  if (!ui || !ui.startPause) {
    return;
  }
  function updateSpeedLabel() {
    ui.speed.textContent = `Speed: ${state.speedMultiplier}×`;
  }
  function updateRunLabel() {
    ui.startPause.textContent = state.running ? '⏸ Pause' : '▶ Start';
  }
  function updateScores() {
    ui.redScore.textContent = `Red ${state.score.red}`;
    ui.blueScore.textContent = `Blue ${state.score.blue}`;
  }

  ui.startPause.onclick = () => {
    state.running = !state.running;
    updateRunLabel();
  };
  ui.reset.onclick = () => {
    resetState(state);
    spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
    spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
    reFormFleets(state);
    updateScores();
  };
  ui.addRed.onclick = () => {
    spawnShip(state, 'red', randomClass(state));
  };
  ui.addBlue.onclick = () => {
    spawnShip(state, 'blue', randomClass(state));
  };
  ui.toggleTrails.onclick = () => {
    RendererConfig.visual.enableTrails = !RendererConfig.visual.enableTrails;
    ui.toggleTrails.textContent = `☄ Trails: ${RendererConfig.visual.enableTrails ? 'On' : 'Off'}`;
  };
  ui.speed.onclick = () => {
    const seq = [0.5, 1, 2, 4] as const;
    // Use findIndex to avoid casting to `any` and satisfy strict typing rules.
    const i = seq.findIndex((v) => v === state.speedMultiplier);
    const next = seq[(i + 1) % seq.length];
    state.speedMultiplier = next;
    updateSpeedLabel();
  };
  ui.seedBtn.onclick = () => {
    const s = `SEED-${Date.now()}`;
    resetState(state, s);
    spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
    spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
    reFormFleets(state);
    updateScores();
  };
  ui.formationBtn.onclick = () => {
    state.ships = [];
    state.bullets = [];
    const fleetSize = FleetConfig.spawning.defaultFleetSize;
    for (let i = 0; i < fleetSize; i++) {
      const redClass = randomClass(state);
      const blueClass = randomClass(state);
      spawnShip(state, 'red', redClass);
      spawnShip(state, 'blue', blueClass);
    }
    updateScores();
  };

  updateSpeedLabel();
  updateRunLabel();
  updateScores();
}
