import type { GameState, UIElements } from '../types/index.js';
import { simulateStep, spawnFleet } from './gameState.js';
import { FleetConfig } from '../config/fleetConfig.js';
import { perfBegin, perfEnd } from '../utils/perf.js';

export function startLoops(state: GameState, ui: UIElements): void {
  const fixedDt = 1 / state.simConfig.tickRate;
  let last = performance.now();
  let acc = 0;
  let fpsAccum = 0,
    fpsFrames = 0,
    _fpsTime = 0;

  function frame(now: number) {
    perfBegin('frame.total');

    const dt = (now - last) / 1000;
    last = now;
    acc += dt;

    if (state.running) {
      // Fixed-step simulation with speed multiplier
      perfBegin('simulation.step');
      const maxSteps = 5;
      let steps = 0;
      while (acc >= fixedDt && steps < maxSteps) {
        simulateStep(state, fixedDt * state.speedMultiplier);
        try {
          state.physicsStepper?.step(fixedDt * state.speedMultiplier);
        } catch (_e) {
          void _e;
        }
        state.time += fixedDt * state.speedMultiplier;
        state.tick++;
        state.frame = (state.frame ?? 0) + 1;
        acc -= fixedDt;
        steps++;
      }
      perfEnd('simulation.step');

      // Auto-respawn if continuous
      perfBegin('game.respawn');
      if (ui.continuous.checked) {
        const redAlive = state.ships.some((s) => s.team === 'red');
        const blueAlive = state.ships.some((s) => s.team === 'blue');
        if (!redAlive) spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
        if (!blueAlive) spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
      }
      perfEnd('game.respawn');
    }

    // Render
    perfBegin('renderer.total');
    state.renderer?.render(dt);
    perfEnd('renderer.total');

    // Stats
    perfBegin('ui.stats');
    fpsAccum += dt;
    fpsFrames++;
    _fpsTime += dt;
    if (fpsAccum >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAccum);
      ui.stats.textContent = `FPS ${fps} • Ships ${state.ships.length} • Bullets ${state.bullets.length} • Tick ${state.tick}`;
      (document.getElementById('redScore') as HTMLDivElement).textContent =
        `Red ${state.score.red}`;
      (document.getElementById('blueScore') as HTMLDivElement).textContent =
        `Blue ${state.score.blue}`;
      fpsAccum = 0;
      fpsFrames = 0;
    }
    perfEnd('ui.stats');

    perfEnd('frame.total');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
