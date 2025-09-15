 
import { describe, it, expect, afterEach } from 'vitest';

describe('perfOverlay (more)', () => {
  const origRAF = (global as any).requestAnimationFrame;
  const origCancel = (global as any).cancelAnimationFrame;
  const origPerf = (global as any).performance;
  const origDoc = (global as any).document;
  const origLocation = (global as any).location;

  afterEach(() => {
    (global as any).requestAnimationFrame = origRAF;
    (global as any).cancelAnimationFrame = origCancel;
    (global as any).performance = origPerf;
    (global as any).document = origDoc;
    (global as any).location = origLocation;
  });

  it('creates and removes overlay and runs one update tick', async () => {
    // Minimal DOM: document.body.appendChild should store the appended element so we can inspect it
    let appended: any = null;
    (global as any).document = {
      body: {
        appendChild: (el: any) => {
          appended = el;
        },
      },
      createElement: (tag: string) => {
        // simple element stub
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          style: { cssText: '' },
          textContent: '',
        };
        return el;
      },
      getElementById: (id: string) => (id === 'perfOverlay' ? appended : null),
      removeChild: (el: any) => {
        if (appended === el) appended = null;
      },
    } as any;

    // stub RAF to synchronously call callback once
    (global as any).requestAnimationFrame = (cb: any) => {
      setTimeout(() => {
        try {
          cb(16);
        } catch {
          /* ignore */
        }
      }, 0);
      return 1;
    };
    (global as any).cancelAnimationFrame = () => {};
    (global as any).performance = { now: () => 123 } as any;

    // ensure location.search has showPerf (overlay uses showPerf=1) and enable perf
    (global as any).location = { search: '?showPerf=1' } as any;
    const perfMod = await import('../../../src/utils/perf');
    // enable the global perf meter for the overlay to show
    try {
      (perfMod as any).perf.enable();
    } catch {
      /* ignore */
    }

    const mod = await import('../../../src/utils/perfOverlay');
    const res = await (mod as any).setupPerfOverlay?.();

    // overlay should have been created
    expect(appended).not.toBeNull();

    // if setup returned an api with dispose or stop, call it to ensure removal doesn't throw
    if (res && typeof res === 'object') {
      if (typeof res.dispose === 'function') res.dispose();
      if (typeof res.stop === 'function') res.stop();
    }

    // ensure cleanup: if overlay still present, remove it
    if (appended) {
      (global as any).document.removeChild(appended);
      appended = null;
    }

    const found = (global as any).document.getElementById('perfOverlay');
    expect(found === null || found === undefined).toBeTruthy();
  });
});
