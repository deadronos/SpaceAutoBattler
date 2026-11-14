import type { GameState } from '../../types/index.js';
import { enqueueDeferredMutation, recordRapierGuardTrip } from '../simulationQueue.js';
import type { KinematicBody } from './types.js';

interface KinematicBatch {
  bodies: KinematicBody[];
  values: Float32Array;
  rotations: boolean[];
  flush: () => void;
}

const batches = new WeakMap<GameState, KinematicBatch>();
const STRIDE = 7;

function getBatch(state: GameState): KinematicBatch {
  let batch = batches.get(state);
  if (batch) return batch;

  const position = { x: 0, y: 0, z: 0 };
  const rotation = { x: 0, y: 0, z: 0, w: 1 };
  const created: KinematicBatch = {
    bodies: [],
    values: new Float32Array(128 * STRIDE),
    rotations: [],
    flush: () => {
      const { bodies, values, rotations } = created;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i]!;
        const offset = i * STRIDE;
        position.x = values[offset]!;
        position.y = values[offset + 1]!;
        position.z = values[offset + 2]!;
        try {
          body.setNextKinematicTranslation(position);
        } catch (error) {
          recordRapierGuardTrip(state, error);
        }
        if (rotations[i]) {
          rotation.x = values[offset + 3]!;
          rotation.y = values[offset + 4]!;
          rotation.z = values[offset + 5]!;
          rotation.w = values[offset + 6]!;
          try {
            body.setNextKinematicRotation?.(rotation);
          } catch (error) {
            recordRapierGuardTrip(state, error);
          }
        }
      }
      bodies.length = 0;
      rotations.length = 0;
    },
  };
  batches.set(state, created);
  return created;
}

/** Queues a snapshot of a ship or turret transform for the pre-physics flush. */
export function enqueueKinematicTransform(
  state: GameState,
  body: KinematicBody | null,
  position: { x: number; y: number; z: number },
  rotation?: { x: number; y: number; z: number; w: number },
): void {
  if (!body) return;
  const batch = getBatch(state);
  if (batch.bodies.length === 0) enqueueDeferredMutation(state, batch.flush);

  const offset = batch.bodies.length * STRIDE;
  if (offset === batch.values.length) {
    const expanded = new Float32Array(batch.values.length * 2);
    expanded.set(batch.values);
    batch.values = expanded;
  }
  batch.values[offset] = position.x;
  batch.values[offset + 1] = position.y;
  batch.values[offset + 2] = position.z;
  if (rotation) {
    batch.values[offset + 3] = rotation.x;
    batch.values[offset + 4] = rotation.y;
    batch.values[offset + 5] = rotation.z;
    batch.values[offset + 6] = rotation.w;
  }
  batch.bodies.push(body);
  batch.rotations.push(rotation !== undefined);
}
