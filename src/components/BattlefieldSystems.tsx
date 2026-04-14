import type React from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameState } from '../game/context.js';
import { updateGame } from '../game/systems.js';
import { useUiStore } from '../game/uiStore.js';
import { shouldRenderWorkerShipsOnly } from '../game/SimulationBridge.js';
import { reportPhysicsError } from '../utils/errorReporting.js';

export const MAX_ALLOWED_SIMULATION_SUBSTEPS = 5;

/**
 * Time budget in milliseconds for the simulation loop per frame.
 * If exceeded, the loop breaks early to prevent death spirals.
 */
export const SIMULATION_TIME_BUDGET_MS = 12;

/**
 * Limits the number of substeps to prevent death spirals on slow frames.
 *
 * @param {number} value - The requested number of substeps.
 * @returns {number} The clamped value.
 */
export function clampSimulationSubsteps(value: number): number {
  const normalized = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  return Math.min(MAX_ALLOWED_SIMULATION_SUBSTEPS, normalized);
}

/**
 * Component that runs the simulation loop within the React Three Fiber update cycle.
 * It does not render anything visual but drives the game state updates.
 *
 * @returns {React.ReactElement} A fragment (no DOM).
 */
export function BattlefieldSystems(): React.ReactElement {
  const state = useGameState();
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const disableMainTick = shouldRenderWorkerShipsOnly();

  useFrame((_, delta) => {
    state.paused = paused;
    state.timeScale = timeScale;

    if (disableMainTick) {
      state.simulation.alpha = 0;
      return;
    }

    if (paused) {
      state.simulation.alpha = 0;
      return;
    }

    const sim = state.simulation;
    const step = sim.step;
    const maxSteps = clampSimulationSubsteps(sim.maxSubSteps);
    const scaled = Math.max(0, delta * Math.max(timeScale, 0));

    if (step <= 0) {
      updateGame(state, scaled);
      sim.alpha = 0;
      return;
    }

    const maxAccum = step * maxSteps;
    sim.accumulator = Math.min(sim.accumulator + Math.min(scaled, maxAccum), maxAccum);

    try {
      const params = (state.physicsWorld as { integrationParameters?: { dt: number } })
        .integrationParameters;
      if (params && typeof params.dt === 'number') {
        params.dt = step;
      }
    } catch (error) {
      reportPhysicsError('integrationParameters.dt', undefined, error);
    }

    const loopStart = performance.now();
    let steps = 0;
    while (sim.accumulator >= step && steps < maxSteps) {
      updateGame(state, step);
      sim.accumulator -= step;
      steps += 1;
      if (performance.now() - loopStart > SIMULATION_TIME_BUDGET_MS) {
        break;
      }
    }

    sim.alpha = step > 0 ? Math.min(sim.accumulator / step, 1) : 0;
  });

  return <></>;
}
