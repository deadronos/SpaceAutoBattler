import { getFileWatcher } from '../../../src/utils/fileWatcher';

describe('FileWatcher header precedence', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  test('prefers last-modified over etag/content-length', async () => {
    const lastModified = new Date(Date.UTC(2020, 1, 1)).toUTCString();
    (global as any).fetch = async () => ({
      ok: true,
      headers: {
        get: (k: string) => {
          if (k === 'last-modified') return lastModified;
          if (k === 'etag') return 'W/"v1"';
          if (k === 'content-length') return '1234';
          return null;
        },
      },
    });

    const fw = getFileWatcher();
    const called: Array<{ path: string; type: string }> = [];
    fw.watch('http://example.com/asset.svg', (p, t) => called.push({ path: p, type: t }));

    await fw.checkAllFiles();

    // First-time discovery should call created
    expect(called.length).toBe(1);
    expect(called[0].type).toBe('created');
  });

  test('falls back to etag when last-modified missing', async () => {
    (global as any).fetch = async () => ({
      ok: true,
      headers: {
        get: (k: string) => {
          if (k === 'last-modified') return null;
          if (k === 'etag') return 'abc123';
          return null;
        },
      },
    });

    const fw = getFileWatcher();
    const called: Array<{ path: string; type: string }> = [];
    fw.watch('http://example.com/asset2.svg', (p, t) => called.push({ path: p, type: t }));

    await fw.checkAllFiles();

    expect(called.length).toBe(1);
    expect(called[0].type).toBe('created');
  });
});
