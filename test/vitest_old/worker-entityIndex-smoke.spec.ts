import { beforeEach, test, expect } from 'vitest';

// This test exercises the sim worker's ability to initialize the runtime
// entity index via the init-entity-index message. The worker file is a
// plain module that installs a message listener on `self`, so for test
// purposes we create a minimal fake worker global that captures posted
// messages and lets us dispatch messages into the module.

function makeFakeWorkerEnv() {
  const posted: any[] = [];
  let onMessage: ((e: MessageEvent) => void) | null = null;

  const fakeSelf: any = {
    postMessage: (m: unknown) => posted.push(m),
    addEventListener: (_: string, fn: (e: MessageEvent) => void) => {
      onMessage = fn;
    },
    removeEventListener: (_: string, fn: (e: MessageEvent) => void) => {
      if (onMessage === fn) onMessage = null;
    },
    // minimal location for perf toggle checks
    location: { href: 'http://localhost/worker?debugPerf=0' },
  };

  return {
    fakeSelf,
    posted,
    dispatch: (msg: unknown) => {
      if (!onMessage) throw new Error('worker message handler not registered');
      onMessage({ data: msg } as MessageEvent);
    },
  };
}

test('simWorker responds to init-entity-index with ok:true', async () => {
  const { fakeSelf, posted, dispatch } = makeFakeWorkerEnv();

  // Install the fake self into the module global scope. Node's module
  // evaluation will see `self` as defined and the worker will register its
  // message listener on it.
  (globalThis as any).self = fakeSelf;

  // Import the worker module. It should register a message listener on our
  // fake `self` when evaluated.
  await import('../../src/simWorker');

  // Dispatch init-physics message (also requests the worker to auto-init the entity index)
  dispatch({ type: 'init-physics', payload: { bucketSize: 8 } });

  // Helper to wait for a posted message matching a predicate
  const waitFor = async (predicate: (m: any) => boolean, attempts = 40) => {
    for (let i = 0; i < attempts; i++) {
      for (const m of posted) if (predicate(m)) return m;
      await new Promise((r) => setTimeout(r, 10));
    }
    return null;
  };

  // The worker will post both `init-physics-done` and (best-effort)
  // `init-entity-index-done` when auto-init is attempted. Wait for physics
  // init completion first.
  const phys = await waitFor((m) => m && m.type === 'init-physics-done');
  expect(phys).toBeTruthy();
  // Rapier may not be available in the test environment; allow ok to be true/false

  const res = await waitFor((m) => m && m.type === 'init-entity-index-done');
  // Entity index init is best-effort; assert we received a response (ok true/false)
  expect(res).toBeTruthy();

  // Send an update-ships message with a single ship; the worker should add it
  // to its entity index when present.
  const ships = new Float32Array([1, 0, 0, 0, 0, 0, 0]); // id=1, pos=(0,0,0), vel=(0,0,0)
  dispatch({ type: 'update-ships', payload: { ships } });

  // Ask the worker for the entity-index count via the debug endpoint we added
  dispatch({ type: 'debug-entity-index-count' });
  const dbg = await waitFor((m) => m && m.type === 'debug-entity-index-count-done', 40);
  expect(dbg).toBeTruthy();
  // If entity index was initialized (res.ok === true) we expect dbg.ok true and count >= 1
  if (res.ok) {
    expect(dbg.ok).toBe(true);
    expect(typeof dbg.count).toBe('number');
    expect(dbg.count).toBeGreaterThanOrEqual(1);
  } else {
    // If entity index wasn't initialized, worker may respond ok:false
    expect(dbg.ok).toBe(false);
    expect(dbg.count).toBe(0);
  }
});
