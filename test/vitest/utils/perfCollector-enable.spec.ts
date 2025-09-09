/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

import { enablePerfCollectorIfRequested } from '../../../src/utils/perfCollector';

describe('perfCollector enable', () => {
  it('creates window.__perf when debugPerf=1 in location.search', () => {
    // mock a global location with search
    const origLocation = (globalThis as any).location;
    (globalThis as any).location = { search: '?debugPerf=1' } as any;

    // mock requestAnimationFrame to no-op so the collector's loop won't schedule timers in Node
    const origRAF = (globalThis as any).requestAnimationFrame;
    const origCancelRAF = (globalThis as any).cancelAnimationFrame;
    const origPerfNow = (globalThis as any).performance?.now;
  (globalThis as any).requestAnimationFrame = (_cb: unknown) => 0;
  (globalThis as any).cancelAnimationFrame = (_: unknown) => {};
    (globalThis as any).performance = (globalThis as any).performance || { now: () => Date.now() };
    (globalThis as any).performance.now = (globalThis as any).performance.now || (() => Date.now());

    // ensure no prior perf
    delete (globalThis as any).__perf;

    enablePerfCollectorIfRequested();

    expect((globalThis as any).__perf).toBeDefined();
    expect(typeof (globalThis as any).__perf.addEvent).toBe('function');
    expect(typeof (globalThis as any).__perf.getFpsStats).toBe('function');

    // cleanup
    delete (globalThis as any).__perf;
    (globalThis as any).location = origLocation;
    (globalThis as any).requestAnimationFrame = origRAF;
    (globalThis as any).cancelAnimationFrame = origCancelRAF;
    if (origPerfNow) (globalThis as any).performance.now = origPerfNow;
  });
});
