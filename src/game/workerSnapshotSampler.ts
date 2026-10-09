import type { TransformSoAViews } from '../worker/transformsLayout.js';

export interface WorkerShipMotionSample {
  id: number;
  slot: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  hp: number;
  shield: number;
  thrust: number;
}

/**
 * Samples up to `limit` ships' motion from the worker's SoA transform views.
 * Pure: no bridge state, so it can be unit-tested with a synthetic buffer.
 *
 * @param {TransformSoAViews} views - SoA transform views.
 * @param {ReadonlyMap<number, number>} slotByShipId - ship id -> slot index.
 * @param {number} limit - Maximum number of samples.
 * @returns {WorkerShipMotionSample[]}
 */
export function sampleShipMotion(
  views: TransformSoAViews,
  slotByShipId: ReadonlyMap<number, number>,
  limit: number,
): WorkerShipMotionSample[] {
  const ships: WorkerShipMotionSample[] = [];
  const max = Math.max(0, Math.floor(limit));

  for (const [id, slot] of slotByShipId) {
    if (ships.length >= max) break;

    const pBase = slot * 3;
    const rBase = slot * 4;

    ships.push({
      id,
      slot,
      position: {
        x: views.positions[pBase + 0] ?? 0,
        y: views.positions[pBase + 1] ?? 0,
        z: views.positions[pBase + 2] ?? 0,
      },
      rotation: {
        x: views.rotations[rBase + 0] ?? 0,
        y: views.rotations[rBase + 1] ?? 0,
        z: views.rotations[rBase + 2] ?? 0,
        w: views.rotations[rBase + 3] ?? 1,
      },
      hp: views.shipHp[slot] ?? 0,
      shield: views.shipShield[slot] ?? 0,
      thrust: views.shipThrust[slot] ?? 0,
    });
  }

  return ships;
}
