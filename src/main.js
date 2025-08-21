import { createCanvasRenderer } from './renderer.js';
import webglMod from './webglRenderer.js';
import * as GM from './gamemanager.js';
import { createShip } from './entities.js';
import { srand, srandom } from './rng.js';

const canvas = document.getElementById('world');
function fitCanvas() {
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Prefer WebGL renderer when available (helps reproduce WebGL runtime issues);
// fall back to Canvas renderer for environments without WebGL.
let renderer = null;
try {
  if (webglMod && typeof webglMod.createWebGLRenderer === 'function') {
    const tryWebgl = webglMod.createWebGLRenderer(canvas, { webgl2: true });
    if (tryWebgl && tryWebgl.init && tryWebgl.init()) {
      renderer = tryWebgl;
      console.log('[main] using WebGL renderer');
    }
  }
} catch (e) {
  console.warn('WebGL renderer init failed, falling back to canvas renderer', e);
}
if (!renderer) {
  renderer = createCanvasRenderer(canvas);
  renderer.init();
}

// Expose a test-friendly handle to the game manager so E2E tests can inspect state
// (kept minimal: only exported object reference, no API additions)
window.__GM = GM;
// Test-only helper: return the live ships array (avoids issues with bundler export wrappers)
window.__getGMShips = () => (window.__GM && window.__GM.ships) ? window.__GM.ships : [];

// Default deterministic seed for simulation & visuals so runs are repeatable
const DEFAULT_SEED = 1;
GM.reset(DEFAULT_SEED);

const startBtn = document.getElementById('startPause');
const resetBtn = document.getElementById('reset');
const addRed = document.getElementById('addRed');
const addBlue = document.getElementById('addBlue');
const seedBtn = document.getElementById('seedBtn');

// For WebGL renderer we run a separate RAF loop that drives the simulation and
// calls renderer.render(state). Canvas renderer manages its own loop internally.
let _rafId = null;
let _lastTime = null;
function webglLoop(nowMs) {
  if (!renderer || !renderer.isRunning()) { _rafId = null; return; }
  const now = nowMs / 1000;
  const dt = _lastTime ? Math.min(0.05, now - _lastTime) : 1/60;
  _lastTime = now;
  const state = GM.simulate(dt, canvas.width, canvas.height);
  try { renderer.render(state); } catch (e) { console.warn('renderer.render error', e); }
  _rafId = requestAnimationFrame(webglLoop);
}

startBtn.addEventListener('click', () => {
  if (!renderer.isRunning()) {
    renderer.start();
    startBtn.textContent = '⏸ Pause';
    _lastTime = null;
    if (renderer.type === 'webgl') _rafId = requestAnimationFrame(webglLoop);
  } else {
    renderer.stop();
    startBtn.textContent = '▶ Start';
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  }
});

resetBtn.addEventListener('click', () => { GM.reset(); });
addRed.addEventListener('click', () => { GM.ships.push(createShip({ x:100, y:100, team:'red' })); });
addBlue.addEventListener('click', () => { GM.ships.push(createShip({ x:700, y:500, team:'blue' })); });
seedBtn.addEventListener('click', () => { const s = Math.floor(srandom()*0xffffffff); srand(s); GM.reset(s); alert('Seed: '+s); });

// auto start
if (renderer.type === 'webgl') {
  renderer.start();
  _rafId = requestAnimationFrame(webglLoop);
} else {
  renderer.start();
}
