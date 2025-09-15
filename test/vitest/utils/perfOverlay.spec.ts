 
import { describe, it, expect } from 'vitest';

import { setupPerfOverlay } from '../../../src/utils/perfOverlay';

describe('perfOverlay', () => {
  it('does nothing when perf is disabled', () => {
    // Ensure perf is disabled by default
    const origPerf = (globalThis as any).perf;
    if ((globalThis as any).perf && typeof (globalThis as any).perf.disable === 'function') {
      (globalThis as any).perf.disable();
    }

    // Ensure no overlay element exists
    const before = document.getElementById('perfOverlay');
    expect(before).toBeNull();

    setupPerfOverlay();

    const after = document.getElementById('perfOverlay');
    expect(after).toBeNull();

    if (origPerf) (globalThis as any).perf = origPerf;
  });
});
