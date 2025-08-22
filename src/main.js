// Minimal main.js - bundler-friendly entry that wires UI to game manager and renderer
import { createGameManager } from './gamemanager.js';
import { CanvasRenderer } from './canvasrenderer.js';
import { WebGLRenderer } from './webglrenderer.js';
import { getDefaultBounds } from './config/displayConfig.js';

export async function startApp(rootDocument = document) {
  const canvas = rootDocument.getElementById('world');
  const ui = {
    startPause: rootDocument.getElementById('startPause'),
    reset: rootDocument.getElementById('reset'),
    addRed: rootDocument.getElementById('addRed'),
    addBlue: rootDocument.getElementById('addBlue'),
    toggleTrails: rootDocument.getElementById('toggleTrails'),
    speed: rootDocument.getElementById('speed'),
    redScore: rootDocument.getElementById('redScore'),
    blueScore: rootDocument.getElementById('blueScore'),
    stats: rootDocument.getElementById('stats'),
    continuousCheckbox: rootDocument.getElementById('continuousCheckbox'),
    seedBtn: rootDocument.getElementById('seedBtn'),
    formationBtn: rootDocument.getElementById('formationBtn'),
  };

  function fitCanvasToWindow() {
    const dpr = window.devicePixelRatio || 1;
    const bounds = getDefaultBounds();
    canvas.style.width = `${bounds.W}px`;
    canvas.style.height = `${bounds.H}px`;
    canvas.width = Math.round(bounds.W * dpr);
    canvas.height = Math.round(bounds.H * dpr);
  }

  fitCanvasToWindow();
  window.addEventListener('resize', fitCanvasToWindow);

  // Choose renderer (prefer WebGL if available)
  let renderer;
  try {
    renderer = new WebGLRenderer(canvas);
    if (!renderer.init()) throw new Error('webgl init failed');
  } catch (e) {
    console.warn('WebGL renderer not available, falling back to Canvas2D', e);
    renderer = new CanvasRenderer(canvas);
    renderer.init();
  }

  const gm = createGameManager({ renderer, canvas });

  ui.startPause.addEventListener('click', () => {
    if (gm.isRunning()) { gm.pause(); ui.startPause.textContent = '▶ Start'; }
    else { gm.start(); ui.startPause.textContent = '⏸ Pause'; }
  });
  ui.reset.addEventListener('click', () => gm.reset());
  ui.addRed.addEventListener('click', () => gm.spawnShip('red'));
  ui.addBlue.addEventListener('click', () => gm.spawnShip('blue'));
  ui.seedBtn.addEventListener('click', () => gm.reseed());
  ui.formationBtn.addEventListener('click', () => gm.formFleets());

  // basic UI update loop
  function uiTick() {
    const s = gm.snapshot();
    ui.redScore.textContent = `Red ${gm.score.red}`;
    ui.blueScore.textContent = `Blue ${gm.score.blue}`;
    ui.stats.textContent = `Ships: ${s.ships.length} Bullets: ${s.bullets.length}`;
    requestAnimationFrame(uiTick);
  }
  requestAnimationFrame(uiTick);

  return { gm, renderer };
}

// Start automatically when running in a browser with DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startApp(document));
  else startApp(document);
}

export default startApp;
