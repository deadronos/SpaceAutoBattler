import { describe, it, expect } from 'vitest';
// path not needed in this test

describe('simWorker RNG seed propagation', () => {
  it('worker should use provided rngSeed for its RNG', async () => {
    // Use Worker created by test setup (WorkerMock in setupTests.ts)
    // Create a worker instance (path is ignored by the mock)
    // Provide a deterministic seed
    const seed = 'unit-test-seed-42';
    // @ts-ignore - Worker is available via setup mock
    const worker = new Worker('mock://simWorker');

    // Wait for init-ai-done after sending init request with rngSeed
    const initDone = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('init timeout')), 2000);
      const onMsg = (e: any) => {
        if (!e || !e.data) return;
        if (e.data.type === 'init-ai-done') {
          clearTimeout(t);
          worker.removeEventListener('message', onMsg);
          resolve();
        }
      };
      worker.addEventListener('message', onMsg);
    });

    worker.postMessage({ type: 'init-ai', payload: { rngSeed: seed } });
    await initDone;

    // Ask the worker for an RNG sample
    const sample = await new Promise<number | null>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('rng sample timeout')), 2000);
      const onMsg = (e: any) => {
        if (!e || !e.data) return;
        if (e.data.type === 'rng-sample') {
          clearTimeout(t);
          worker.removeEventListener('message', onMsg);
          resolve(e.data.value as number | null);
        }
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage({ type: 'get-rng-next' });
    });

    // Compare with a local RNG created from same seed
    // createRNG is available globally via setupTests.ts export
  const { createRNG } = await import('../../src/utils/rng.js');
    const local = createRNG(seed);
    const expected = local.next();

    // Both should be numbers and equal (deterministic RNG)
    expect(typeof sample).toBe('number');
    // Compare with tolerance for float precision
    expect(sample).toBeCloseTo(expected, 12);
  });
});
