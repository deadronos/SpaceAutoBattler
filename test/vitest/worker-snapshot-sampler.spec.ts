import { describe, expect, it } from 'vite-plus/test';
import { sampleShipMotion } from '../../src/game/workerSnapshotSampler.js';
import type { TransformSoAViews } from '../../src/worker/transformsLayout.js';

function makeViews(
  entries: Record<
    number,
    {
      p: [number, number, number];
      r: [number, number, number, number];
      hp?: number;
      shield?: number;
      thrust?: number;
    }
  >,
  capacity = 4,
): TransformSoAViews {
  const positions = new Float32Array(capacity * 3);
  const rotations = new Float32Array(capacity * 4);
  const scales = new Float32Array(capacity);
  const shipHp = new Float32Array(capacity);
  const shipShield = new Float32Array(capacity);
  const shipThrust = new Float32Array(capacity);

  for (const [slotStr, entry] of Object.entries(entries)) {
    const slot = Number(slotStr);
    positions.set(entry.p, slot * 3);
    rotations.set(entry.r, slot * 4);
    shipHp[slot] = entry.hp ?? 0;
    shipShield[slot] = entry.shield ?? 0;
    shipThrust[slot] = entry.thrust ?? 0;
  }

  return { positions, rotations, scales, shipHp, shipShield, shipThrust };
}

describe('sampleShipMotion', () => {
  it('samples motion from SoA views and respects the limit', () => {
    const views = makeViews({
      0: { p: [1, 2, 3], r: [0, 0, 0, 1], hp: 10, shield: 2, thrust: 0.5 },
    });
    const slots = new Map([[42, 0]]);

    expect(sampleShipMotion(views, slots, 5)).toEqual([
      {
        id: 42,
        slot: 0,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        hp: 10,
        shield: 2,
        thrust: 0.5,
      },
    ]);

    expect(sampleShipMotion(views, slots, 0)).toEqual([]);
  });
});
