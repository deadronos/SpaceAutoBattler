import { describe, expect, it } from 'vite-plus/test';
import {
  FOV_KICK_MAX_DEG,
  FOV_KICK_RADIUS_THRESHOLD,
  TRAUMA_DECAY_PER_SEC,
  TRAUMA_MAX,
  TRAUMA_RADIUS_REF,
  addExplosionTrauma,
  addFovKick,
  advanceExplosionCursor,
  createTraumaState,
  isFovKickBlast,
  maxExplosionId,
  traumaAmplitude,
  updateTrauma,
} from '../../../src/renderer/cameraRig/shake.js';

describe('camera rig shake math', () => {
  it('createTraumaState starts empty', () => {
    expect(createTraumaState()).toEqual({ trauma: 0, fovKick: 0 });
  });

  it('addExplosionTrauma scales linearly with radius and clamps at TRAUMA_MAX', () => {
    const s = createTraumaState();
    addExplosionTrauma(s, TRAUMA_RADIUS_REF / 2);
    expect(s.trauma).toBeCloseTo(0.5);

    addExplosionTrauma(s, TRAUMA_RADIUS_REF * 10);
    expect(s.trauma).toBe(TRAUMA_MAX);
  });

  it('addExplosionTrauma ignores non-positive radius', () => {
    const s = createTraumaState();
    addExplosionTrauma(s, -5);
    expect(s.trauma).toBe(0);
    addExplosionTrauma(s, 0);
    expect(s.trauma).toBe(0);
  });

  it('addExplosionTrauma scales mildly with flashIntensity', () => {
    const low = createTraumaState();
    const high = createTraumaState();
    addExplosionTrauma(low, TRAUMA_RADIUS_REF / 2, 1.1);
    addExplosionTrauma(high, TRAUMA_RADIUS_REF / 2, 1.45);
    expect(high.trauma).toBeGreaterThan(low.trauma);
    // The flash contribution stays mild: both remain near the radius factor.
    expect(low.trauma).toBeGreaterThan(0.35);
    expect(high.trauma).toBeLessThan(0.65);
  });

  it('addExplosionTrauma keeps accumulating across blasts', () => {
    const s = createTraumaState();
    addExplosionTrauma(s, TRAUMA_RADIUS_REF / 4);
    addExplosionTrauma(s, TRAUMA_RADIUS_REF / 4);
    expect(s.trauma).toBeCloseTo(0.5);
  });

  it('updateTrauma decays trauma and fovKick by sim-time delta', () => {
    const s = createTraumaState();
    s.trauma = 1;
    s.fovKick = FOV_KICK_MAX_DEG;
    updateTrauma(s, 0.25);
    expect(s.trauma).toBeCloseTo(1 - TRAUMA_DECAY_PER_SEC * 0.25);
    expect(s.fovKick).toBeGreaterThan(0);
    expect(s.fovKick).toBeLessThan(FOV_KICK_MAX_DEG);
  });

  it('updateTrauma floors both values at 0', () => {
    const s = createTraumaState();
    s.trauma = 0.1;
    s.fovKick = 0.1;
    updateTrauma(s, 100);
    expect(s.trauma).toBe(0);
    expect(s.fovKick).toBe(0);
  });

  it('updateTrauma ignores non-positive or non-finite deltas', () => {
    const s = createTraumaState();
    s.trauma = 0.5;
    s.fovKick = 1;
    updateTrauma(s, 0);
    updateTrauma(s, -1);
    updateTrauma(s, Number.NaN);
    expect(s.trauma).toBe(0.5);
    expect(s.fovKick).toBe(1);
  });

  it('traumaAmplitude is trauma squared', () => {
    expect(traumaAmplitude(0)).toBe(0);
    expect(traumaAmplitude(0.5)).toBe(0.25);
    expect(traumaAmplitude(1)).toBe(1);
    expect(traumaAmplitude(2)).toBe(1);
  });

  it('isFovKickBlast uses the radius threshold inclusively', () => {
    expect(isFovKickBlast(FOV_KICK_RADIUS_THRESHOLD - 0.01)).toBe(false);
    expect(isFovKickBlast(FOV_KICK_RADIUS_THRESHOLD)).toBe(true);
    expect(isFovKickBlast(FOV_KICK_RADIUS_THRESHOLD + 5)).toBe(true);
  });

  it('addFovKick accumulates and clamps to FOV_KICK_MAX_DEG', () => {
    const s = createTraumaState();
    addFovKick(s, 1);
    expect(s.fovKick).toBe(1);
    addFovKick(s, 100);
    expect(s.fovKick).toBe(FOV_KICK_MAX_DEG);
    addFovKick(s, -10);
    expect(s.fovKick).toBe(0);
  });

  it('maxExplosionId never lowers the cursor below the list max', () => {
    expect(maxExplosionId([], 7)).toBe(7);
    expect(
      maxExplosionId(
        [
          { id: 3, radius: 1 },
          { id: 9, radius: 1 },
        ],
        7,
      ),
    ).toBe(9);
    expect(maxExplosionId([{ id: 2, radius: 1 }], 7)).toBe(7);
  });

  it('advanceExplosionCursor accrues trauma for new ids only', () => {
    const s = createTraumaState();
    const cursor = advanceExplosionCursor(
      [
        { id: 1, radius: TRAUMA_RADIUS_REF, flashIntensity: 1.2 },
        { id: 2, radius: TRAUMA_RADIUS_REF },
      ],
      0,
      s,
    );
    expect(cursor).toBe(2);
    expect(s.trauma).toBe(TRAUMA_MAX);
  });

  it('advanceExplosionCursor adds an FOV kick for large blasts', () => {
    const s = createTraumaState();
    advanceExplosionCursor([{ id: 1, radius: FOV_KICK_RADIUS_THRESHOLD }], 0, s);
    expect(s.fovKick).toBeGreaterThan(0);
  });

  it('advanceExplosionCursor re-syncs after a reset and shakes again', () => {
    const s = createTraumaState();
    // Pre-reset session: cursor advanced into the forties.
    let cursor = advanceExplosionCursor(
      [
        { id: 41, radius: 4 },
        { id: 42, radius: 4 },
      ],
      40,
      s,
    );
    expect(cursor).toBe(42);

    // Reset: the list is cleared and ids restart at 1. The cursor must drop so
    // the first kill of the new match still shakes (this is the regression that
    // the old `maxExplosionId(events, cursor) < cursor` check missed).
    s.trauma = 0;
    cursor = advanceExplosionCursor([], cursor, s);
    expect(cursor).toBe(0);
    expect(s.trauma).toBe(0);

    cursor = advanceExplosionCursor([{ id: 1, radius: TRAUMA_RADIUS_REF }], cursor, s);
    expect(cursor).toBe(1);
    expect(s.trauma).toBeGreaterThan(0);
  });

  it('advanceExplosionCursor skips stale ids when the first post-reset frame already has events', () => {
    const s = createTraumaState();
    // No empty-list frame observed: the list already holds restarted ids below
    // the stale cursor, so they are treated as a reset (no trauma burst).
    const cursor = advanceExplosionCursor(
      [
        { id: 1, radius: TRAUMA_RADIUS_REF },
        { id: 2, radius: TRAUMA_RADIUS_REF },
      ],
      50,
      s,
    );
    expect(cursor).toBe(2);
    expect(s.trauma).toBe(0);

    // A genuinely new kill then shakes.
    advanceExplosionCursor(
      [
        { id: 2, radius: TRAUMA_RADIUS_REF },
        { id: 3, radius: TRAUMA_RADIUS_REF },
      ],
      cursor,
      s,
    );
    expect(s.trauma).toBeGreaterThan(0);
  });
});
