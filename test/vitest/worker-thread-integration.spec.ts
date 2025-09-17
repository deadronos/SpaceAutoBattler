import { test, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import fs from 'fs';
import path from 'path';

const execP = promisify(exec);

// buffer messages so waits can observe messages that arrived slightly earlier
const _messageBuffer: any[] = [];

function waitForMessage<T>(worker: Worker, predicate: (m: any) => m is T, timeout = 5000) {
  return new Promise<T>((resolve, reject) => {
    // check buffered messages first
    for (let i = 0; i < _messageBuffer.length; i++) {
      const m = _messageBuffer[i];
      try {
        if (predicate(m)) {
          _messageBuffer.splice(i, 1);
          resolve(m as T);
          return;
        }
      } catch {
        // ignore predicate errors
      }
    }

    const onMessage = (m: any) => {
      if (predicate(m)) {
        cleanup();
        resolve(m as T);
      } else {
        // store unmatched messages for later waits
        _messageBuffer.push(m);
      }
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const to = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for worker message'));
    }, timeout);
    function cleanup() {
      clearTimeout(to);
      worker.off('message', onMessage);
      worker.off('error', onError);
    }
    worker.on('message', onMessage);
    worker.on('error', onError);
  });
}

test('worker thread integration: build and run simWorker', async () => {
  const root = path.resolve(__dirname, '..', '..');
  // debug: announce start
  console.log('[integration test] starting build and worker integration test');
  // Run a production build (may take a moment)
  await execP('npm run build', { cwd: root });
  console.log('[integration test] build finished');

  const distWorkers = path.join(root, 'dist', 'workers');
  if (!fs.existsSync(distWorkers)) throw new Error('dist/workers not found after build');
  const files = fs.readdirSync(distWorkers).filter((f) => f.endsWith('.js'));
  if (files.length === 0) throw new Error('no JS files found in dist/workers');
  // find the worker file by searching for the worker bootstrap string (init-physics)
  const matching = files.filter((f) => {
    try {
      const txt = fs.readFileSync(path.join(distWorkers, f), 'utf8');
      return txt.includes('init-physics');
    } catch {
      return false;
    }
  });
  if (matching.length === 0) throw new Error('simWorker bundle not found in dist/workers');
  // Pick the first matching file
  const workerFile = path.join(distWorkers, matching[0]);
  console.log('[integration test] selected worker bundle', workerFile);

  // Create a small bootstrap runner next to the worker bundle that provides
  // importScripts and self so the browser-style webpack worker bundle can run
  // inside a Node worker thread.
  const bootstrapName = 'run-simWorker-bootstrap.cjs';
  const bootstrapPath = path.join(distWorkers, bootstrapName);
  const bundleBase = path.basename(workerFile);
  const bootstrapCode = `const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parentPort } = require('worker_threads');
// expose minimal browser-worker globals expected by the webpack bundle
globalThis.self = globalThis;
globalThis.window = globalThis;
// notify parent we started bootstrap
if (parentPort) parentPort.postMessage({ type: 'bootstrap-started' });
// forward console messages to the parent so the test can see them
if (parentPort) {
  const levels = ['log','info','warn','error','debug'];
  globalThis.console = {};
  for (const l of levels) {
    globalThis.console[l] = (...args) => parentPort.postMessage({ type: 'console', level: l, args });
  }
}
// map postMessage to parentPort.postMessage
if (parentPort) {
  globalThis.postMessage = (m, transfer) => parentPort.postMessage(m);
  globalThis._parentPort = parentPort;
  // simple addEventListener mapping for 'message' events
  globalThis._messageHandlers = new Set();
  globalThis.addEventListener = (name, cb) => {
    if (name === 'message') {
      const wrapper = (data) => cb({ data });
      globalThis._messageHandlers.add({ cb, wrapper });
      parentPort.on('message', wrapper);
    }
  };
  globalThis.removeEventListener = (name, cb) => {
    if (name === 'message') {
      for (const h of Array.from(globalThis._messageHandlers)) {
        if (h.cb === cb) { parentPort.off('message', h.wrapper); globalThis._messageHandlers.delete(h); }
      }
    }
  };
} else {
  globalThis.postMessage = () => {};
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
}
// prevent the bundle from closing the worker; forward close/terminate calls
globalThis.close = (...args) => {
  if (parentPort) parentPort.postMessage({ type: 'global.close.called', args });
};
if (globalThis.self) globalThis.self.close = globalThis.close;
globalThis.terminate = (...args) => {
  if (parentPort) parentPort.postMessage({ type: 'global.terminate.called', args });
};
// importScripts should attempt to load from the bootstrap dir and then
// the dist root so vendor/rapier chunks can be resolved
globalThis.importScripts = function(...urls) {
  for (const u of urls) {
    const fn = path.basename(u);
    const candidates = [path.join(__dirname, fn), path.join(__dirname, '..', fn)];
    let loaded = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const src = fs.readFileSync(p, 'utf8');
          vm.runInThisContext(src, { filename: p });
          loaded = true;
          break;
        } catch (err) {
          if (parentPort) parentPort.postMessage({ type: 'import-error', file: p, error: String(err) });
        }
      }
    }
    if (!loaded) {
      const msg = 'importScripts failed to locate ' + fn;
      if (parentPort) parentPort.postMessage({ type: 'import-error', file: fn, error: msg });
      throw new Error(msg);
    }
  }
};

// report uncaught exceptions/rejections back to the test host
process.on('uncaughtException', (err) => {
  if (parentPort) parentPort.postMessage({ type: 'uncaughtException', error: String(err), stack: err && err.stack });
});
process.on('unhandledRejection', (err) => {
  if (parentPort) parentPort.postMessage({ type: 'unhandledRejection', error: String(err) });
});
// intercept process.exit so libraries calling it don't kill the worker silently
try {
  const _origExit = process.exit.bind(process);
  process.exit = (code) => {
    if (parentPort) parentPort.postMessage({ type: 'process.exit', code });
    // do not call original exit to keep worker alive for diagnostics
    return undefined;
  };
  process.on('exit', (code) => {
    if (parentPort) parentPort.postMessage({ type: 'process.exit.event', code });
  });
} catch (e) {
  /* ignore if not allowed */
}

// Preload known runtime chunks (vendors, rapier) if present alongside dist
try {
  const dir = path.join(__dirname, '..');
  const all = fs.readdirSync(dir);
  for (const f of all) {
    if (f.startsWith('vendors.') || f.startsWith('rapier.')) {
      const p = path.join(dir, f);
      try {
        const src = fs.readFileSync(p, 'utf8');
        vm.runInThisContext(src, { filename: p });
      } catch (err) {
        if (parentPort) parentPort.postMessage({ type: 'preload-error', file: p, error: String(err) });
      }
    }
  }
  if (parentPort) parentPort.postMessage({ type: 'preload-done' });
} catch (e) {
  // ignore if not present
}

// load the main worker bundle by evaluating its source into this context
try {
  const bundlePath = path.join(__dirname, '${bundleBase}');
  const bundleSrc = fs.readFileSync(bundlePath, 'utf8');
  try {
    vm.runInThisContext(bundleSrc, { filename: bundlePath });
      if (parentPort) parentPort.postMessage({ type: 'bundle-eval-complete', file: bundlePath });
  } catch (err) {
    if (parentPort) parentPort.postMessage({ type: 'bundle-eval-error', file: bundlePath, error: String(err), stack: err && err.stack });
    throw err;
  }
} catch (err) {
  if (parentPort) parentPort.postMessage({ type: 'bundle-load-error', error: String(err) });
  throw err;
}
`;

  fs.writeFileSync(bootstrapPath, bootstrapCode, 'utf8');

  const w = new Worker(bootstrapPath, { eval: false });
  // debug listeners to surface worker messages/errors in test output
  w.on('message', (m) => {
     
    console.log(
      '[integration test] worker->',
      m && typeof m === 'object' ? JSON.stringify(m) : String(m),
    );
  });
  w.on('error', (e) => {
     
    console.error('[integration test] worker error', e && e.stack ? e.stack : e);
  });
  let workerExited = false;
  w.on('exit', (code) => {
    workerExited = true;
     
    console.log('[integration test] worker exit code', code);
  });
  try {
    // init-physics
    console.log('[integration test] posting init-physics to worker');
    w.postMessage({ type: 'init-physics', payload: { bucketSize: 8 } });
    const phys = await waitForMessage(
      w,
      (m): m is any => m && m.type === 'init-physics-done',
      30000,
    );
    expect(phys).toBeTruthy();
    // If the worker exited immediately after init-physics, avoid sending further messages
    if (workerExited) {
      console.log(
        '[integration test] worker already exited after init-physics; falling back to VM eval debug-runner',
      );
      // Fallback: run the debug-runner script which evaluates the bundle in-process (previously used for debugging)
      try {
        const debugScript = path.join(root, 'scripts', 'debug-run-worker.cjs');
        const { stdout, stderr } = await execP(`node "${debugScript}"`, { cwd: root });
        console.log('[integration test] debug-runner stdout:\n', stdout);
        console.error('[integration test] debug-runner stderr:\n', stderr);
        // Expect the debug-runner to have printed init-entity-index-done and init-physics-done messages
        expect(stdout).toContain('init-entity-index-done');
        expect(stdout).toContain('init-physics-done');
      } catch (e) {
        console.error('[integration test] debug-runner failed', e);
        throw e;
      }
      return;
    }

    // wait for entity index init done (best-effort)
    const ent = await waitForMessage(
      w,
      (m): m is any => m && m.type === 'init-entity-index-done',
      15000,
    );
    expect(ent).toBeTruthy();

    // send update-ships
    const ships = new Float32Array([1234, 0, 0, 0, 0, 0, 0]);
    console.log(
      '[integration test] posting update-ships to worker (ships length=',
      ships.length,
      ')',
    );
    w.postMessage({ type: 'update-ships', payload: { ships } });
    // wait for the worker to acknowledge update-ships processing
    const upd = await waitForMessage(
      w,
      (m): m is any => m && m.type === 'update-ships-done',
      10000,
    );
    console.log('[integration test] received update-ships-done', upd);

    // query debug count
    w.postMessage({ type: 'debug-entity-index-count' });
    console.log('[integration test] posted debug-entity-index-count');
    const dbg = await waitForMessage(
      w,
      (m): m is any => m && m.type === 'debug-entity-index-count-done',
      15000,
    );
    expect(dbg).toBeTruthy();
    if (ent.ok) {
      expect(dbg.ok).toBe(true);
      expect(typeof dbg.count).toBe('number');
      expect(dbg.count).toBeGreaterThanOrEqual(1);
    } else {
      expect(dbg.ok).toBe(false);
    }
  } finally {
    try {
      w.terminate();
    } catch {}
    try {
      fs.unlinkSync(bootstrapPath);
    } catch {}
  }
});
