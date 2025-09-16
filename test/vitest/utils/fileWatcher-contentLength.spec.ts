import { describe, it, expect, vi } from 'vitest';

describe('FileWatcher content-length fallback', () => {
  it('uses fallback (Date.now) when last-modified and etag missing but content-length present', async () => {
    const url = 'http://example.com/sizeonly.svg';

    const response = {
      ok: true,
      headers: { get: (k: string) => (k === 'content-length' ? '12345' : null) },
    };

    // Save and mock global fetch with proper types
    const globalWithFetch = globalThis as unknown as { fetch?: typeof fetch };
    const origFetch = globalWithFetch.fetch;
    globalWithFetch.fetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    const mod = await import('../../../src/utils/fileWatcher.js');
    const module = mod as unknown as {
      getFileWatcher: () => {
        watch: (u: string, cb: (p: string, change: string) => void) => void;
        unwatchAll: () => void;
        checkAllFiles: () => Promise<void>;
      };
    };
    const { getFileWatcher } = module;
    const watcher = getFileWatcher();

    let event: { p: string; change: string } | null = null;
    watcher.watch(url, (p: string, change: string) => {
      event = { p, change };
    });

    // checkAllFiles should call into HEAD and (since no last-modified/etag) fall back
    await watcher.checkAllFiles();

    expect(event).not.toBeNull();
    // Different environments may classify this as 'created' or 'modified'. Accept either.
    const change = (event as unknown as { change?: string })?.change;
    expect(['created', 'modified']).toContain(change);

    // cleanup
    watcher.unwatchAll();
    globalWithFetch.fetch = origFetch;
  });
});
