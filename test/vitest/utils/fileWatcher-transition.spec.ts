import { describe, it, expect, vi } from 'vitest';

describe('FileWatcher transitions', () => {
  it('detects created then deleted when HEAD changes between requests', async () => {
    const url = 'http://example.com/transient.svg';

    // Prepare fetch to return: 1) non-ok (missing), 2) ok with last-modified, 3) non-ok (deleted)
    const dateStr = new Date().toUTCString();
    const first = { ok: false, headers: { get: (_: string) => null } };
    const second = {
      ok: true,
      headers: { get: (k: string) => (k === 'last-modified' ? dateStr : null) },
    };
    const third = { ok: false, headers: { get: (_: string) => null } };

    const origFetch = (globalThis as any).fetch;
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(third);
    (globalThis as any).fetch = mockFetch;

    const mod = await import('../../../src/utils/fileWatcher');
    const { getFileWatcher } = mod as any;
    const watcher = getFileWatcher();

    const events: Array<{ path: string; change: string }> = [];
    watcher.watch(url, (p: string, change: any) => {
      events.push({ path: p, change });
    });

    // First call happens from watch() initial check (consumes first mocked response)
    // Now trigger second check which should detect creation
    await watcher.checkAllFiles();

    // Allow microtasks for the notify to run
    expect(events.length).toBeGreaterThanOrEqual(0);

    // After second response we should have a 'created' event
    const created = events.find((e) => e.change === 'created');
    expect(created).toBeDefined();
    expect(created && created.path).toBe(url);

    // Trigger third check which should detect deletion and unwatch the file
    await watcher.checkAllFiles();

    const deleted = events.find((e) => e.change === 'deleted');
    expect(deleted).toBeDefined();
    expect(watcher.getWatchedFiles().every((f: string) => f !== url)).toBe(true);

    // cleanup
    watcher.unwatchAll();
    (globalThis as any).fetch = origFetch;
  });
});
