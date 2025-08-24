import { describe, it, expect } from 'vitest';
import startApp from '../../src/main';

describe('startApp dispose lifecycle', () => {
  it('returns a dispose() that removes window.gm and is idempotent', async () => {
    // Ensure there's a canvas element for the renderer to attach to (JSDOM)
    const c = document.createElement('canvas');
    c.id = 'world';
    document.body.appendChild(c);

    // Start the app (uses JSDOM document provided by Vitest)
    const session = await startApp(document as any);
    expect(session).toBeTruthy();
    expect(typeof session.dispose).toBe('function');

    // window.gm should be set by startApp
    // (dispose will delete it)
    expect((window as any).gm).toBeTruthy();

    // Call dispose and verify it removed the global and does not throw on second call
    session.dispose();
    expect((window as any).gm).toBeUndefined();

    // Calling dispose again should be a no-op (no throw)
    expect(() => session.dispose()).not.toThrow();
  });
});
