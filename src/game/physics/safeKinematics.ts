export type KinematicBody = {
  setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void;
};

/**
 * Safely submit the next kinematic translation for a rigid body.
 * Guards against disposed bodies or mid-step Rapier restrictions.
 */
export function safeSetNextKinematicTranslation(
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!rb) return;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  try {
    rb.setNextKinematicTranslation({ x, y, z });
  } catch {
    // Ignore invalid operations; GameState sync will reconcile on the next frame.
  }
}
