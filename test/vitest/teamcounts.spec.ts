import { describe, it, expect } from 'vitest';
import createGameManager from '../../src/gamemanager';
import { makeInitialState, createShip } from '../../src/entities';

describe('teamCounts', () => {
  it('increments on spawnShip and decrements after removal (main thread)', () => {
    const gm = createGameManager({ renderer: null, useWorker: false, seed: 42 });
    // Start with empty fleets
    gm.reset();
    // spawn a red ship
    const ship = gm.spawnShip('red');
    const snap1 = gm.snapshot();
    // Invariant: teamCounts should equal actual ships per-team
    const actualRed = (snap1.ships || []).filter((sh: any) => sh.team === 'red').length;
    expect(snap1.teamCounts.red).toBe(actualRed);
    // Move the ship out of bounds via simulate step: set position far away and run stepOnce
    if (ship) {
      ship.x = -9999; ship.y = -9999;
    }
    if (typeof gm.stepOnce === 'function') gm.stepOnce(0.1);
    const snap2 = gm.snapshot();
    const actualRed2 = (snap2.ships || []).filter((sh: any) => sh.team === 'red').length;
    expect(snap2.teamCounts.red).toBe(actualRed2);
  });

  it('rebuilds teamCounts when worker snapshot/setState is applied', () => {
    // Create a fake worker factory that captures handlers so we can simulate a snapshot
    let capturedWorker: any = null;
    const fakeFactory = (/* url?: string */) => {
      const handlers: Record<string, Function> = {};
      const w = {
        on: (evt: string, cb: Function) => { handlers[evt] = cb; },
        post: (_msg: any) => {},
        off: (_evt: string, _cb: Function) => {},
        terminate: () => {},
        _handlers: handlers,
      };
      capturedWorker = w;
      return w;
    };

    const gm = createGameManager({ renderer: null, useWorker: true, seed: 42, createSimWorker: fakeFactory });
    // Build state and call the snapshot handler the worker would call
    const state = makeInitialState();
    state.ships.push(createShip(undefined, 0, 0, 'red'));
    state.ships.push(createShip(undefined, 0, 0, 'blue'));
    // Invoke the captured snapshot handler
    if (capturedWorker && capturedWorker._handlers && typeof capturedWorker._handlers['snapshot'] === 'function') {
      capturedWorker._handlers['snapshot']({ state });
    }
    const snap = gm.snapshot();
    const actualRed = (snap.ships || []).filter((sh: any) => sh.team === 'red').length;
    const actualBlue = (snap.ships || []).filter((sh: any) => sh.team === 'blue').length;
    expect(snap.teamCounts.red).toBe(actualRed);
    expect(snap.teamCounts.blue).toBe(actualBlue);
  });
});
