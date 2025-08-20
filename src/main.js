import { createCanvasRenderer } from './renderer.js';
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

const renderer = createCanvasRenderer(canvas);
renderer.init();

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

startBtn.addEventListener('click', () => {
  if (!renderer.isRunning()) { renderer.start(); startBtn.textContent = '⏸ Pause'; }
  else { renderer.stop(); startBtn.textContent = '▶ Start'; }
});
resetBtn.addEventListener('click', () => { GM.reset(); });
addRed.addEventListener('click', () => { GM.ships.push(createShip({ x:100, y:100, team:'red' })); });
addBlue.addEventListener('click', () => { GM.ships.push(createShip({ x:700, y:500, team:'blue' })); });
seedBtn.addEventListener('click', () => { const s = Math.floor(srandom()*0xffffffff); srand(s); GM.reset(s); alert('Seed: '+s); });

// auto start
renderer.start();
