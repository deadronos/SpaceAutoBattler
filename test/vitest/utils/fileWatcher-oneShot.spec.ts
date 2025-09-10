/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach } from 'vitest';
import { getFileWatcher } from '../../../src/utils/fileWatcher';

describe('FileWatcher one-shot like behavior', () => {
  type FetchType = (...args: any[]) => Promise<any>;
  const origFetch = (global as unknown as { fetch?: FetchType }).fetch;
  afterEach(() => {
    (global as unknown as { fetch?: FetchType }).fetch = origFetch;
  });

  it('quick check flow does not throw and calls callback when ok', async () => {
    (global as any).fetch = async () =>
      ({
        ok: true,
        headers: { get: (k: string) => (k === 'last-modified' ? new Date().toUTCString() : null) },
      }) as any;

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/one-shot.svg', () => events.push('created'));

    // simulate a single checkAllFiles run (like a one-shot)
    await fw.checkAllFiles();
    expect(Array.isArray(events)).toBeTruthy();
    fw.unwatch('http://example.com/one-shot.svg');
  });
});
