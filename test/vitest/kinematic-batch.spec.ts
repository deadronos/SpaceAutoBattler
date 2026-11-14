import { describe, expect, it } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { enqueueKinematicTransform } from '../../src/game/physics/kinematicBatch.js';
import { flushDeferredMutations } from '../../src/game/simulationQueue.js';
import { createTestGameState } from './helpers/fixtures.js';

describe('kinematic transform batch', () => {
  it('snapshots transforms in enqueue order and stays isolated between states', () => {
    const first = createTestGameState();
    const second = createTestGameState();
    const updates: number[] = [];
    const body = {
      setNextKinematicTranslation: (value: { x: number }) => updates.push(value.x),
      setNextKinematicRotation: (value: { w: number }) => updates.push(value.w),
    };
    const position = new Vector3(3, 0, 0);
    const rotation = new Quaternion();
    enqueueKinematicTransform(first, body, position, rotation);
    position.x = 7;
    rotation.w = 0;
    enqueueKinematicTransform(second, body, position);
    position.x = 5;
    enqueueKinematicTransform(first, body, position);
    expect(first.simulation.deferredMutations).toHaveLength(1);
    expect(second.simulation.deferredMutations).toHaveLength(1);
    flushDeferredMutations(second);
    flushDeferredMutations(first);
    expect(updates).toEqual([7, 3, 1, 5]);
  });

  it('continues after a guarded physics error and grows without dropping writes', () => {
    const state = createTestGameState();
    const updates: number[] = [];
    const position = new Vector3();
    enqueueKinematicTransform(
      state,
      {
        setNextKinematicTranslation: () => {
          throw new Error('body removed');
        },
      },
      position,
    );
    const body = { setNextKinematicTranslation: (value: { x: number }) => updates.push(value.x) };
    for (let i = 0; i < 300; i++) {
      position.x = i;
      enqueueKinematicTransform(state, body, position);
    }
    flushDeferredMutations(state);
    expect(updates).toEqual(Array.from({ length: 300 }, (_, i) => i));
    expect(state.simulation.rapierDiagnostics.guardTrips).toBe(1);
  });
});
