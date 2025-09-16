const fs = require('fs');
const path = require('path');
const vm = require('vm');

const workersDir = path.join(__dirname, '..', 'dist', 'workers');
const files = fs.readdirSync(workersDir).filter((f) => f.endsWith('.js'));
const matching = files.filter((f) => {
  try {
    const txt = fs.readFileSync(path.join(workersDir, f), 'utf8');
    return txt.includes('init-physics');
  } catch {
    return false;
  }
});
if (matching.length === 0) {
  console.error('no simWorker bundle found in dist/workers');
  process.exit(1);
}
const bundle = matching[0];
console.log('loading bundle', bundle);

// Basic worker-like globals and event handling so the browser-built worker
// bundle can be evaluated inside Node for debugging.
globalThis.self = globalThis;
globalThis.window = globalThis;

const listeners = { message: [] };

globalThis.addEventListener = (type, cb) => {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(cb);
};

globalThis.removeEventListener = (type, cb) => {
  if (!listeners[type]) return;
  listeners[type] = listeners[type].filter((f) => f !== cb);
};

// Worker -> host
globalThis.postMessage = (msg) => {
  console.log('[worker -> host]', JSON.stringify(msg));
};

// Emulate importScripts by loading the referenced files from dist/workers
globalThis.importScripts = function (...urls) {
  for (const u of urls) {
    const fn = path.basename(u);
    // try workers dir first, then dist root
    const candidates = [path.join(workersDir, fn), path.join(__dirname, '..', fn)];
    let loaded = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const src = fs.readFileSync(p, 'utf8');
        vm.runInThisContext(src, { filename: p });
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      throw new Error(`importScripts failed to locate ${fn} in expected locations`);
    }
  }
};

const bundlePath = path.join(workersDir, bundle);
const src = fs.readFileSync(bundlePath, 'utf8');

try {
  // Evaluate the bundle in the current context (simulates worker global scope)
  vm.runInThisContext(src, { filename: bundlePath });
} catch (err) {
  console.error('error while evaluating bundle:', err && err.stack ? err.stack : err);
  process.exit(1);
}

// Give the evaluated bundle a moment to set up its message listener, then
// simulate sending an init-physics message so the worker runs its init path.
setTimeout(() => {
  const init = { type: 'init-physics', payload: { bucketSize: 64 } };
  if (listeners.message && listeners.message.length) {
    console.log('sending init-physics to worker (simulated)');
    for (const cb of listeners.message) {
      try {
        // mimic the browser message event shape
        cb({ data: init });
      } catch (e) {
        console.error('error in message handler callback:', e);
      }
    }
  } else {
    console.warn('no message listeners registered by bundle');
  }
}, 20);

// keep process alive a little to observe messages and logs
setTimeout(() => {
  console.log('done');
}, 4000);
