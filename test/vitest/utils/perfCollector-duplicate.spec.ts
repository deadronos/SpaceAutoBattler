/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

import { enablePerfCollectorIfRequested } from '../../../src/utils/perfCollector';

describe('perfCollector duplicate', () => {
  it('does not overwrite existing window.__perf', () => {
    const origLocation = (globalThis as any).location;
    (globalThis as any).location = { search: '?debugPerf=1' } as any;

    const original = { addEvent: () => {}, getFpsStats: () => ({ avgFps: 60, p99FrameMs: 16 }) };
    (globalThis as any).__perf = original;

    enablePerfCollectorIfRequested();

    expect((globalThis as any).__perf).toBe(original);

    // cleanup
    delete (globalThis as any).__perf;
    (globalThis as any).location = origLocation;
  });
});
