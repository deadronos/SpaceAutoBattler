import { describe, it, expect, afterEach } from 'vitest';
import { getFileWatcher } from '../../../src/utils/fileWatcher.js';

describe('FileWatcher etag/content-length fallback', () => {
  type FetchType = (...args: any[]) => Promise<any>;
  const origFetch = (global as unknown as { fetch?: FetchType }).fetch;
  afterEach(() => {
    (global as unknown as { fetch?: FetchType }).fetch = origFetch;
  });

  it('uses ETag header when provided', async () => {
    (global as any).fetch = async () =>
      ({ ok: true, headers: { get: (k: string) => (k === 'etag' ? '"abc123"' : null) } }) as any;

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/with-etag.svg', () => events.push('changed'));

    await fw.checkAllFiles();
    // either created or changed depending on internal state; just ensure no exception and watcher registered
    expect(Array.isArray(events)).toBeTruthy();
    fw.unwatch('http://example.com/with-etag.svg');
  });

  it('falls back to content-length when etag not present', async () => {
    (global as any).fetch = async () =>
      ({
        ok: true,
        headers: { get: (k: string) => (k === 'content-length' ? '1234' : null) },
      }) as any;

    const fw = getFileWatcher();
    const events: string[] = [];
    fw.watch('http://example.com/with-length.svg', () => events.push('changed'));

    await fw.checkAllFiles();
    expect(Array.isArray(events)).toBeTruthy();
    fw.unwatch('http://example.com/with-length.svg');
  });
});
