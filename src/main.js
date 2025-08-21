import { createCanvasRenderer } from './renderer.js';
import webglMod from './webglRenderer.js';
import * as GM from './gamemanager.js';
import { createShip } from './entities.js';
import { srand, srandom } from './rng.js';

// Ensure a canvas with id 'world' exists so the app can boot in tests/environments
let canvas = document.getElementById('world');
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.id = 'world';
  // put it before the end of body so styles/defaults apply
  (document.body || document.documentElement).appendChild(canvas);
}

function fitCanvas() {
  if (!canvas) return;
  try {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // use client size if available, otherwise fallback to current size
    const w = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 1);
    canvas.width = w;
    canvas.height = h;
  } catch (e) {
    // defensive: ignore sizing errors (e.g., detached DOM in some test runners)
  }
}
window.addEventListener && window.addEventListener('resize', fitCanvas);
fitCanvas();

// Prefer WebGL renderer when available (helps reproduce WebGL runtime issues);
// fall back to Canvas renderer for environments without WebGL.
let renderer = null;
// simple programmatic atlas accessor: creates a small canvas sprite for a given type/radius
function makeSimpleAtlas(type, radius) {
  const pad = 4;
  const size = Math.max(8, Math.ceil(radius * 2 + pad * 2));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  // base hull (white, to be tinted in shader)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  // accent
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.arc(cx - radius * 0.25, cy - radius * 0.25, Math.max(1, radius * 0.35), 0, Math.PI * 2); ctx.fill();
  return { canvas: c, size, baseRadius: radius };
}

try {
  if (webglMod && typeof webglMod.createWebGLRenderer === 'function') {
    const tryWebgl = webglMod.createWebGLRenderer(canvas, { webgl2: true, atlasAccessor: (type, radius) => makeSimpleAtlas(type, radius) });
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
  if (renderer && renderer.init) renderer.init();
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
  if (!renderer || (typeof renderer.isRunning === 'function' && !renderer.isRunning())) { _rafId = null; return; }
  const now = nowMs / 1000;
  const dt = _lastTime ? Math.min(0.05, now - _lastTime) : 1/60;
  _lastTime = now;
  const state = GM.simulate(dt, canvas.width, canvas.height);
  try { renderer && renderer.render && renderer.render(state); } catch (e) { console.warn('renderer.render error', e); }
  _rafId = requestAnimationFrame(webglLoop);
}

if (startBtn) {
  startBtn.addEventListener('click', () => {
    const running = typeof renderer.isRunning === 'function' ? renderer.isRunning() : false;
    if (!running) {
      renderer.start && renderer.start();
      startBtn.textContent = '⏸ Pause';
      _lastTime = null;
      if (renderer && typeof renderer.type === 'string' && renderer.type.indexOf('webgl') === 0) _rafId = requestAnimationFrame(webglLoop);
    } else {
      renderer.stop && renderer.stop();
      startBtn.textContent = '▶ Start';
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    }
  });
}

if (resetBtn) resetBtn.addEventListener('click', () => { GM.reset(); });
if (addRed) addRed.addEventListener('click', () => { GM.ships.push(createShip({ x:100, y:100, team:'red' })); });
if (addBlue) addBlue.addEventListener('click', () => { GM.ships.push(createShip({ x:700, y:500, team:'blue' })); });
if (seedBtn) seedBtn.addEventListener('click', () => { const s = Math.floor(srandom()*0xffffffff); srand(s); GM.reset(s); alert('Seed: '+s); });

// auto start
// Auto-start if renderer supports it. For WebGL we drive the RAF loop from here.
if (renderer) {
  renderer.start && renderer.start();
  if (typeof renderer.type === 'string' && renderer.type.indexOf('webgl') === 0) {
    _rafId = requestAnimationFrame(webglLoop);
  }
}
