// simWorker.js - simulation worker (ES module). Expects to be loaded with Worker({ type: 'module' })
import { simulateStep } from './simulate.js';
import { applySimpleAI } from './behavior.js';
import { srand } from './rng.js';

let state = null;
let bounds = { W: 800, H: 600 };
let simDtMs = 16;
let running = false;
let acc = 0;
let last = 0;

function postSnapshot() {
  // post a lightweight snapshot (structured-clone)
  postMessage({ type: 'snapshot', state });
}

function tick() {
  if (!running) return;
  const now = performance.now();
  if (!last) last = now;
  acc += now - last; last = now;
  if (acc > 250) acc = 250;
  while (acc >= simDtMs) {
    // Apply deterministic behavior before the physics step
    try { applySimpleAI(state, simDtMs / 1000, bounds); } catch (e) { /* ignore behavior errors */ }
    simulateStep(state, simDtMs / 1000, bounds);
    acc -= simDtMs;
  }
  postSnapshot();
  // cooperative scheduling
  setTimeout(tick, 0);
}

onmessage = (ev) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init':
        if (typeof msg.seed === 'number') srand(msg.seed);
        if (msg.bounds) bounds = msg.bounds;
        if (typeof msg.simDtMs === 'number') simDtMs = msg.simDtMs;
        if (msg.state) state = msg.state;
        postMessage({ type: 'ready' });
        break;
      case 'start':
        if (!state) { postMessage({ type: 'error', message: 'no state' }); break; }
        running = true; acc = 0; last = performance.now(); tick();
        break;
      case 'stop':
        running = false; break;
      case 'snapshotRequest':
        postSnapshot(); break;
      case 'setSeed':
        if (typeof msg.seed === 'number') { srand(msg.seed); }
        break;
      case 'command':
        // simple command API: spawnShip { type, x, y, team } or spawnShipBullet
        if (msg.cmd === 'spawnShip' && state) {
          state.ships.push(msg.args.ship);
        } else if (msg.cmd === 'spawnShipBullet' && state) {
          state.bullets.push(msg.args.bullet);
        } else if (msg.cmd === 'setState') {
          state = msg.args.state;
        }
        break;
      default:
        // ignore
        break;
    }
  } catch (err) {
    postMessage({ type: 'error', message: String(err), stack: err.stack });
  }
};

export default null;
