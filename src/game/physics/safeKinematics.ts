import type { GameState } from '../../types/index.js';
import { recordRapierGuardTrip, enqueueDeferredMutation, enqueuePostPhysicsMutation } from '../simulationQueue.js';

export type KinematicBody = {
  setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void;
  setNextKinematicRotation?: (r: { x: number; y: number; z: number; w: number }) => void;
};

/**
 * Safely submit the next kinematic translation for a rigid body.
 * Guards against disposed bodies or mid-step Rapier restrictions.
 */
export function safeSetNextKinematicTranslation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!rb) {
    if (state) recordRapierGuardTrip(state);
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    if (state) recordRapierGuardTrip(state);
    return;
  }
  try {
    rb.setNextKinematicTranslation({ x, y, z });
  } catch (error) {
    if (state) recordRapierGuardTrip(state, error);
    // Ignore invalid operations; GameState sync will reconcile on the next frame.
  }
}

/**
 * Safely submit the next kinematic rotation for a rigid body.
 * Mirrors the translation guard to avoid Rapier "recursive use" errors
 * when multiple systems attempt to mutate the same body during a step.
 */
export function safeSetNextKinematicRotation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  if (!rb || typeof rb.setNextKinematicRotation !== 'function') {
    if (state) recordRapierGuardTrip(state);
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w)) {
    if (state) recordRapierGuardTrip(state);
    return;
  }
  try {
    rb.setNextKinematicRotation({ x, y, z, w });
  } catch (error) {
    if (state) recordRapierGuardTrip(state, error);
    // Ignore invalid operations; GameState sync will reconcile on the next frame.
  }
}

export function deferSetNextKinematicTranslation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error('deferSetNextKinematicTranslation requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }

  enqueueDeferredMutation(state, () => {
    try {
      if (!rb) return;
      rb.setNextKinematicTranslation({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

export function postSetNextKinematicTranslation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error('postSetNextKinematicTranslation requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueuePostPhysicsMutation(state, () => {
    try {
      if (!rb) return;
      rb.setNextKinematicTranslation({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

export function deferSetNextKinematicRotation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error('deferSetNextKinematicRotation requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }

  enqueueDeferredMutation(state, () => {
    try {
      if (!rb || typeof rb.setNextKinematicRotation !== 'function') return;
      rb.setNextKinematicRotation({ x, y, z, w });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

export function postSetNextKinematicRotation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error('postSetNextKinematicRotation requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueuePostPhysicsMutation(state, () => {
    try {
      if (!rb || typeof rb.setNextKinematicRotation !== 'function') return;
      rb.setNextKinematicRotation({ x, y, z, w });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}
