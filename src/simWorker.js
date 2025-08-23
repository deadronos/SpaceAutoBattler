// simWorker.js - simulation worker (ES module). Expects to be loaded with Worker({ type: 'module' })
import { simulateStep } from './simulate.js';
import { applySimpleAI } from './behavior.js';
import { srand, srandom } from './rng.js';
import { createShip } from './entities.js';
import { getShipConfig, getDefaultShipType } from './config/entitiesConfig';

let state = null;
let bounds = { W: 800, H: 600 };
let simDtMs = 16;
let running = false;
let acc = 0;
let last = 0;
// continuous reinforcement state for worker
let continuous = false;
let reinforcementInterval = 5.0; // seconds
let reinforcementAccumulator = 0;

function postSnapshot() {
  // post a lightweight snapshot (structured-clone)
  postMessage({ type: 'snapshot', state });
  // Clear transient event arrays so the worker does not repeatedly resend
  // the same events on every snapshot. The snapshot is cloned by postMessage
  // so it's safe to clear them here.
  try {
    if (state) clearTransientEvents(state);
  } catch (e) {
    // ignore
  }
}

// exported for tests: clear transient worker event arrays after snapshot
export function clearTransientEvents(s) {
  if (!s || typeof s !== 'object') return;
  try {
    if (Array.isArray(s.explosions)) s.explosions.length = 0;
    if (Array.isArray(s.shieldHits)) s.shieldHits.length = 0;
    if (Array.isArray(s.healthHits)) s.healthHits.length = 0;
  } catch (e) { /* ignore */ }
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
    // when running in worker, advance reinforcement accumulator and spawn if enabled
    try {
      const stepSeconds = simDtMs / 1000;
      if (continuous) {
        reinforcementAccumulator += stepSeconds;
        if (reinforcementAccumulator >= reinforcementInterval) {
          reinforcementAccumulator = 0;
          try {
            if (!state || !Array.isArray(state.ships)) continue;
            const redCount = state.ships.filter(s => s && s.team === 'red').length;
            const blueCount = state.ships.filter(s => s && s.team === 'blue').length;
            let weaker = null;
            if (redCount < blueCount) weaker = 'red';
            else if (blueCount < redCount) weaker = 'blue';
            else weaker = (srandom() < 0.5 ? 'red' : 'blue');
            const weakerCount = weaker === 'red' ? redCount : blueCount;
            const deficit = Math.max(0, 3 - weakerCount);
            if (deficit > 0) {
              const maxSpawn = Math.max(1, deficit);
              const spawnCount = Math.min(maxSpawn, Math.max(1, Math.floor(srandom() * maxSpawn) + 1));
              const types = Object.keys(getShipConfig() || { fighter: {} });
              const spawned = [];
              for (let i = 0; i < spawnCount; i++) {
                const type = types[Math.floor(srandom() * types.length)] || getDefaultShipType();
                const jitter = () => (srandom() - 0.5) * 40;
                let x = 0, y = 0;
                if (weaker === 'red') { x = 100 + jitter(); y = 100 + jitter(); }
                else { x = bounds.W - 100 + jitter(); y = bounds.H - 100 + jitter(); }
                const ship = createShip(type, x, y, weaker);
                state.ships.push(ship);
                spawned.push({ id: ship.id, type: ship.type, x: ship.x, y: ship.y, team: ship.team });
              }
              // post a diagnostic message so main thread UI can log/display
              try { postMessage({ type: 'reinforcements', spawned }); } catch (e) {}
              try { console.log('[simWorker] spawned reinforcements', spawned); } catch (e) {}
            }
          } catch (e) {
            // ignore spawn errors
          }
        }
      }
    } catch (e) { /* ignore spawn errors */ }
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
      case 'setContinuous':
        // toggle continuous reinforcements inside the worker
        if (typeof msg.value === 'boolean') {
          continuous = msg.value;
          // reset accumulator when toggling on/off
          reinforcementAccumulator = 0;
        }
        break;
      case 'setReinforcementInterval':
        if (typeof msg.seconds === 'number' && isFinite(msg.seconds) && msg.seconds > 0) {
          reinforcementInterval = msg.seconds;
        }
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
