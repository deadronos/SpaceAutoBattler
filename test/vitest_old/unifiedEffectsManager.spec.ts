import { describe, it, expect } from 'vitest';
import { createUnifiedEffectsManager } from '../../src/renderer/unifiedEffectsManager.js';
import type { GameState } from '../../src/types/index.js';

// Minimal GameState stub for tests
const makeState = (): GameState => {
  return {
    // only properties used by unifiedEffectsManager in tests
    renderer: {} as any,
    ships: [],
    // assetPool or other fields not required for this test
  } as unknown as GameState;
};

describe('UnifiedEffectsManager queued behavior', () => {
  it('queues explosion when effects not ready and flushes when ready', async () => {
    const state = makeState();
    const calls: Array<{ type: string; args: any[] }> = [];
    const injectedEffects: any = {
      initDone: false,
      render: () => {},
      resize: () => {},
      dispose: () => {},
      setBloomIntensity: () => {},
      enableMotionBlur: () => {},
      enableDepthOfField: () => {},
      addExplosionEffect: (pos: any, intensity: number) => {
        calls.push({ type: 'explosion', args: [pos, intensity] });
      },
      addHitSpark: (pos: any, opts: any) => {
        calls.push({ type: 'hit', args: [pos, opts] });
      },
    };

    const mgr = createUnifiedEffectsManager(state, { effects: injectedEffects as any });

    // Fire an explosion while effects not ready
    const pos = { x: 1, y: 2, z: 3 };
    await mgr.handleExplosion(pos, 0.7);

    // No effect calls yet because initDone is false
    expect(calls.length).toBe(0);

    // Now mark effects ready and call update to flush
    injectedEffects.initDone = true;
    // call update with dt so flush path runs
    mgr.update(16 / 1000);

    // One explosion call should have been flushed
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const expl = calls.find((c) => c.type === 'explosion');
    expect(expl).toBeTruthy();
    expect(expl!.args[0]).toEqual(pos);
    expect(expl!.args[1]).toBeCloseTo(0.7);
  });

  it('queues hit sparks when effects not ready and flushes when ready', () => {
    const state = makeState();
    const calls: Array<{ type: string; args: any[] }> = [];
    const injectedEffects2: any = {
      initDone: false,
      render: () => {},
      resize: () => {},
      dispose: () => {},
      setBloomIntensity: () => {},
      enableMotionBlur: () => {},
      enableDepthOfField: () => {},
      addExplosionEffect: (pos: any, intensity: number) => {
        calls.push({ type: 'explosion', args: [pos, intensity] });
      },
      addHitSpark: (pos: any, opts: any) => {
        calls.push({ type: 'hit', args: [pos, opts] });
      },
    };

    const mgr = createUnifiedEffectsManager(state, { effects: injectedEffects2 as any });

    const pos = { x: 4, y: 5, z: 6 };
    mgr.handleHitEffect(pos, 1.2);
    // Still nothing yet
    expect(calls.length).toBe(0);

    injectedEffects2.initDone = true;
    mgr.update(0.016);

    const hit = calls.find((c) => c.type === 'hit');
    expect(hit).toBeTruthy();
    expect(hit!.args[0]).toEqual(pos);
    expect(hit!.args[1]).toHaveProperty('intensity');
  });

  it('drains the queues after flush (no duplicate calls on second update)', async () => {
    const state = makeState();
    const calls: Array<{ type: string; args: any[] }> = [];
    const injectedEffects: any = {
      initDone: false,
      render: () => {},
      resize: () => {},
      dispose: () => {},
      setBloomIntensity: () => {},
      enableMotionBlur: () => {},
      enableDepthOfField: () => {},
      addExplosionEffect: (pos: any, intensity: number) => {
        calls.push({ type: 'explosion', args: [pos, intensity] });
      },
      addHitSpark: (pos: any, opts: any) => {
        calls.push({ type: 'hit', args: [pos, opts] });
      },
    };
    const mgr = createUnifiedEffectsManager(state, { effects: injectedEffects as any });
    const pos = { x: 7, y: 8, z: 9 };
    await mgr.handleExplosion(pos, 0.5);
    mgr.handleHitEffect(pos, 0.9);
    expect(calls.length).toBe(0);
    // First flush
    injectedEffects.initDone = true;
    mgr.update(0.016);
    const callsAfterFirst = calls.length;
    expect(callsAfterFirst).toBe(2);
    // Call update again, should not re-flush
    mgr.update(0.016);
    expect(calls.length).toBe(callsAfterFirst);
    // Optional: use debug getter if present to assert queues are empty
    const dbg = mgr.getDebug?.();
    if (dbg) {
      expect(dbg.queuedExplosions).toBe(0);
      expect(dbg.queuedHitSparks).toBe(0);
    }
  });
});
