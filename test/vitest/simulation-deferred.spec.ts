import { describe, it, expect } from 'vite-plus/test';
import { createTestGameState } from './helpers/fixtures.js';
import {
  deferSetNextKinematicTranslation,
  postSetNextKinematicTranslation,
  deferSetNextKinematicRotation,
  postSetNextKinematicRotation,
} from '../../src/game/physics/safeKinematics.js';
import {
  flushDeferredMutations,
  flushPostPhysicsMutations,
} from '../../src/game/simulationQueue.js';

describe('Deferred mutation execution phases', () => {
  it('executes pre-step deferred mutations on flushDeferredMutations and post-step mutations on flushPostPhysicsMutations', () => {
    const state = createTestGameState();

    const preCalls: string[] = [];
    const postCalls: string[] = [];

    const preBody = {
      setNextKinematicTranslation: ({ x, y, z }: any) => preCalls.push(`translate:${x},${y},${z}`),
      setNextKinematicRotation: ({ x, y, z, w }: any) =>
        preCalls.push(`rotate:${x},${y},${z},${w}`),
    } as any;

    const postBody = {
      setNextKinematicTranslation: ({ x, y, z }: any) => postCalls.push(`translate:${x},${y},${z}`),
      setNextKinematicRotation: ({ x, y, z, w }: any) =>
        postCalls.push(`rotate:${x},${y},${z},${w}`),
    } as any;

    // Enqueue both pre and post mutations
    deferSetNextKinematicTranslation(state, preBody, 1, 2, 3);
    deferSetNextKinematicRotation(state, preBody, 0, 0, 0, 1);

    postSetNextKinematicTranslation(state, postBody, 4, 5, 6);
    postSetNextKinematicRotation(state, postBody, 0, 0, 0, 1);

    // Nothing executed yet
    expect(preCalls.length).toBe(0);
    expect(postCalls.length).toBe(0);

    // Flush pre-step queue
    flushDeferredMutations(state);
    expect(preCalls).toContain('translate:1,2,3');
    expect(preCalls).toContain('rotate:0,0,0,1');
    expect(postCalls.length).toBe(0);

    // Flush post-step queue
    flushPostPhysicsMutations(state);
    expect(postCalls).toContain('translate:4,5,6');
    expect(postCalls).toContain('rotate:0,0,0,1');
  });
});
