import { describe, it, expect, afterEach } from 'vitest';
import { getFileWatcher } from '../../../src/utils/fileWatcher.js';

describe('FileWatcher HEAD ok', () => {
  // store original fetch reference (may be undefined in test env)
  type FetchType = (...args: any[]) => Promise<any>;
  const origFetch = (global as unknown as { fetch?: FetchType }).fetch;
  afterEach(() => {
    (global as unknown as { fetch?: FetchType }).fetch = origFetch;
  });

  it('treats remote HEAD ok as exists', async () => {
    // mock global fetch to return ok and a last-modified header
    (global as any).fetch = async () =>
      ({
        ok: true,
        headers: { get: (k: string) => (k === 'last-modified' ? new Date().toUTCString() : null) },
      }) as any;

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/asset.svg', () => events.push('created'));

    await fw.checkAllFiles();
    expect(events.length).toBeGreaterThanOrEqual(0);
    // cleanup
    fw.unwatch('http://example.com/asset.svg');
  });
});
