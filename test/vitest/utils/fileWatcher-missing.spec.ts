/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach } from 'vitest';
import { getFileWatcher } from '../../../src/utils/fileWatcher';

describe('FileWatcher missing/HEAD not ok', () => {
  type FetchType = (...args: any[]) => Promise<any>;
  const origFetch = (global as unknown as { fetch?: FetchType }).fetch;
  afterEach(() => { (global as unknown as { fetch?: FetchType }).fetch = origFetch; });

  it('handles HEAD returning non-ok gracefully', async () => {
    (global as any).fetch = async () => ({ ok: false } as any);

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/missing.svg', () => events.push('created'));

    // should not throw even if HEAD not ok
    await fw.checkAllFiles();
    expect(Array.isArray(events)).toBeTruthy();
    fw.unwatch('http://example.com/missing.svg');
  });

  it('handles missing headers by not throwing', async () => {
    (global as any).fetch = async () => ({ ok: true, headers: { get: () => null } } as any);

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/no-headers.svg', () => events.push('changed'));

    await fw.checkAllFiles();
    expect(Array.isArray(events)).toBeTruthy();
    fw.unwatch('http://example.com/no-headers.svg');
  });
});
