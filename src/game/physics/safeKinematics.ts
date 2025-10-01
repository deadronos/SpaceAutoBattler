import type { GameState } from '../../types/index.js';
import { recordRapierGuardTrip, enqueueDeferredMutation, enqueuePostPhysicsMutation } from '../simulationQueue.js';

export type KinematicBody = {
  setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void;
  setNextKinematicRotation?: (r: { x: number; y: number; z: number; w: number }) => void;
  // Optional mutators supported by some Rapier bindings
  setLinvel?: (v: { x: number; y: number; z: number }) => void;
  setAngvel?: (v: { x: number; y: number; z: number }) => void;
  setMass?: (m: number) => void;
};

/**
 * Deferred kinematic translation for a rigid body.
 * Queues the translation to be set in the simulation's deferred mutation list,
 * ensuring it will be applied in the correct order with respect to other physics updates.
 */
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

/**
 * Post-physics kinematic translation for a rigid body.
 * Queues the translation to be set after the physics simulation step,
 * allowing for immediate effects in the next frame's simulation.
 */
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

/**
 * Deferred kinematic rotation for a rigid body.
 * Queues the rotation to be set in the simulation's deferred mutation list,
 * ensuring it will be applied in the correct order with respect to other physics updates.
 */
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

/**
 * Post-physics kinematic rotation for a rigid body.
 * Queues the rotation to be set after the physics simulation step,
 * allowing for immediate effects in the next frame's simulation.
 */
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

/**
 * Deferred linear velocity for a rigid body.
 * Queues the velocity to be set in the simulation's deferred mutation list,
 * ensuring it will be applied in the correct order with respect to other physics updates.
 */
export function deferSetLinvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error('deferSetLinvel requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueueDeferredMutation(state, () => {
    try {
      if (!rb || typeof rb.setLinvel !== 'function') return;
      rb.setLinvel({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

/**
 * Post-physics linear velocity for a rigid body.
 * Queues the velocity to be set after the physics simulation step,
 * allowing for immediate effects in the next frame's simulation.
 */
export function postSetLinvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error('postSetLinvel requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueuePostPhysicsMutation(state, () => {
    try {
      if (!rb || typeof rb.setLinvel !== 'function') return;
      rb.setLinvel({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

/**
 * Deferred angular velocity for a rigid body.
 * Queues the velocity to be set in the simulation's deferred mutation list,
 * ensuring it will be applied in the correct order with respect to other physics updates.
 */
export function deferSetAngvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error('deferSetAngvel requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueueDeferredMutation(state, () => {
    try {
      if (!rb || typeof rb.setAngvel !== 'function') return;
      rb.setAngvel({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

/**
 * Post-physics angular velocity for a rigid body.
 * Queues the velocity to be set after the physics simulation step,
 * allowing for immediate effects in the next frame's simulation.
 */
export function postSetAngvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error('postSetAngvel requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueuePostPhysicsMutation(state, () => {
    try {
      if (!rb || typeof rb.setAngvel !== 'function') return;
      rb.setAngvel({ x, y, z });
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

/**
 * Deferred mass setter for a rigid body.
 * Queues the mass to be set in the simulation's deferred mutation list,
 * ensuring it will be applied in the correct order with respect to other physics updates.
 */
export function deferSetMass(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  mass: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error('deferSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueueDeferredMutation(state, () => {
    try {
      if (!rb || typeof rb.setMass !== 'function') return;
      rb.setMass(mass);
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}

/**
 * Post-physics mass setter for a rigid body.
 * Queues the mass to be set after the physics simulation step,
 * allowing for immediate effects in the next frame's simulation.
 */
export function postSetMass(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  mass: number,
): void {
  if (!state || !state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error('postSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation');
  }
  enqueuePostPhysicsMutation(state, () => {
    try {
      if (!rb || typeof rb.setMass !== 'function') return;
      rb.setMass(mass);
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  });
}
