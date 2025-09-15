 
import { describe, it, expect } from 'vitest';

import { enablePerfCollectorIfRequested } from '../../../src/utils/perfCollector';

describe('perfCollector sampling', () => {
  it('populates frame times and returns fps stats when RAF drives sampling', () => {
    const origLocation = (globalThis as any).location;
    const origRAF = (globalThis as any).requestAnimationFrame;
    const origPerf = (globalThis as any).performance?.now;

    // enable via query
    (globalThis as any).location = { search: '?debugPerf=1' } as any;

    // stub performance.now
    (globalThis as any).performance = (globalThis as any).performance || { now: () => 1000 };
    (globalThis as any).performance.now = () => 1000;

    // stub RAF to synchronously invoke the loop a few times but only once to avoid recursion
    let invoked = false;
    (globalThis as any).requestAnimationFrame = (cb: (ts: number) => void) => {
      if (invoked) return 0;
      invoked = true;
      let ts = 1000;
      for (let i = 0; i < 5; i++) {
        ts += 16;
        try {
          cb(ts);
        } catch {
          /* ignore */
        }
      }
      return 0;
    };

    // Ensure clean state
    delete (globalThis as any).__perf;

    enablePerfCollectorIfRequested();

    const perf = (globalThis as any).__perf;
    expect(perf).toBeDefined();
    // frameTimes should have entries from our RAF stub
    expect(Array.isArray(perf._frameTimes)).toBe(true);
    expect(perf._frameTimes.length).toBeGreaterThan(0);

    const stats = perf.getFpsStats();
    expect(stats).toHaveProperty('avgFps');
    expect(stats.avgFps).toBeGreaterThan(0);

    // cleanup
    delete (globalThis as any).__perf;
    (globalThis as any).location = origLocation;
    (globalThis as any).requestAnimationFrame = origRAF;
    if (origPerf) (globalThis as any).performance.now = origPerf;
  });
});
