import { describe, it, expect, vi } from 'vitest';

describe('FileWatcher content-length fallback', () => {
  it('uses fallback (Date.now) when last-modified and etag missing but content-length present', async () => {
    const url = 'http://example.com/sizeonly.svg';

    const response = {
      ok: true,
      headers: { get: (k: string) => (k === 'content-length' ? '12345' : null) }
    };

    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue(response);

    const mod = await import('../../../src/utils/fileWatcher');
    const { getFileWatcher } = mod as any;
    const watcher = getFileWatcher();

    let event: any = null;
    watcher.watch(url, (p: string, change: any) => { event = { p, change }; });

    // checkAllFiles should call into HEAD and (since no last-modified/etag) fall back
    await watcher.checkAllFiles();

    expect(event).not.toBeNull();
    expect(event.change).toBe('created');

    // cleanup
    watcher.unwatchAll();
    (globalThis as any).fetch = origFetch;
  });
});
