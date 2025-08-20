import { createCanvasRenderer } from './renderer.js';
import * as GM from './gamemanager.js';
import { createShip } from './entities.js';
import { srand } from './rng.js';

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
seedBtn.addEventListener('click', () => { const s = Math.floor(Math.random()*0xffffffff); srand(s); GM.reset(s); alert('Seed: '+s); });

// auto start
renderer.start();
