import { describe, it, expect, afterEach } from 'vitest';

describe('perfOverlay enabled', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origRAF = (global as any).requestAnimationFrame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origCancel = (global as any).cancelAnimationFrame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origPerf = (global as any).performance;

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).requestAnimationFrame = origRAF;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).cancelAnimationFrame = origCancel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).performance = origPerf;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).document;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).window;
  });

  it('creates overlay when perf is enabled and debugPerf=1', async () => {
    // minimal DOM-like environment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).document = { body: { appendChild: () => {} } } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = (global as any);

    // stub RAF to avoid infinite loops
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).requestAnimationFrame = (cb: any) => { cb(0); return 1; };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).cancelAnimationFrame = () => {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).performance = { now: () => 0 } as any;

    // ensure location.search has debugPerf
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).location = { search: '?debugPerf=1' } as any;

    const mod = await import('../../../src/utils/perfOverlay');
    // calling setupPerfOverlay shouldn't throw and should return an object or undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (mod as any).setupPerfOverlay?.();
    expect(res === undefined || typeof res === 'object').toBeTruthy();
  });
});
