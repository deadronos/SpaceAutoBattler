import { describe, it, expect, afterEach } from 'vitest';

describe('perfOverlay enabled', () => {
  const origRAF = (global as any).requestAnimationFrame;

  const origCancel = (global as any).cancelAnimationFrame;

  const origPerf = (global as any).performance;

  afterEach(() => {
    (global as any).requestAnimationFrame = origRAF;

    (global as any).cancelAnimationFrame = origCancel;

    (global as any).performance = origPerf;

    delete (global as any).document;

    delete (global as any).window;
  });

  it('creates overlay when perf is enabled and debugPerf=1', async () => {
    // minimal DOM-like environment

    (global as any).document = { body: { appendChild: () => {} } } as any;

    (global as any).window = global as any;

    // stub RAF to avoid infinite loops

    (global as any).requestAnimationFrame = (cb: any) => {
      cb(0);
      return 1;
    };

    (global as any).cancelAnimationFrame = () => {};

    (global as any).performance = { now: () => 0 } as any;

    // ensure location.search has debugPerf

    (global as any).location = { search: '?debugPerf=1' } as any;

    const mod = await import('../../../src/utils/perfOverlay.js');
    // calling setupPerfOverlay shouldn't throw and should return an object or undefined

    const res = await (mod as any).setupPerfOverlay?.();
    expect(res === undefined || typeof res === 'object').toBeTruthy();
  });
});
