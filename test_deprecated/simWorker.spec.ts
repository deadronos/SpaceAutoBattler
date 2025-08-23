import { describe, it, expect } from 'vitest';

// The worker depends on web Worker environment. We'll import its module as a function if exposed,
// otherwise just verify the module exists and can be imported without throwing in jsdom.

describe('simWorker.ts module import', () => {
  it('can be imported in test environment (no runtime execute)', async () => {
    // Dynamic import to avoid hoisting errors if worker uses self
    const mod = await import('../../src/simWorker');
    expect(typeof mod).toBe('object');
  });
});
