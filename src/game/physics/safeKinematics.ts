import type { GameState } from '../../types/index.js';
import { recordRapierGuardTrip } from '../simulationQueue.js';

export type KinematicBody = {
  setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void;
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
