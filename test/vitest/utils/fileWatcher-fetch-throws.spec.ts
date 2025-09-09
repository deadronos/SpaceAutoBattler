import { getFileWatcher } from '../../../src/utils/fileWatcher';

describe('FileWatcher fetch throwing', () => {
  let originalFetch: unknown;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    // Make fetch throw to simulate network error
    (global as any).fetch = () => { throw new Error('network'); };
  });

  afterEach(() => {
    // restore original fetch if it exists
    try { (global as any).fetch = originalFetch as any; } catch { /* ignore */ }
  });

  test('handles fetch throwing without uncaught exception', async () => {
    const fw = getFileWatcher();
    const called: Array<{path:string,type:string}> = [];
    fw.watch('http://example.com/asset.svg', (p, t) => called.push({path:p,type:t}));

    // Force a checkAllFiles to run the code path
    await expect(fw.checkAllFiles()).resolves.toBeUndefined();

    // No callback should have been called because fetch failed
    expect(called.length).toBe(0);
  });
});
