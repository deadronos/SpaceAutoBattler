// Minimal main.js - bundler-friendly entry that wires UI to game manager and renderer
import { createGameManager } from './gamemanager.js';
import { CanvasRenderer } from './canvasrenderer.js';
import { WebGLRenderer } from './webglrenderer.js';
import { getDefaultBounds } from './config/displayConfig.js';
import { getPreferredRenderer, RendererConfig } from './config/rendererConfig.js';

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
    const baseDpr = window.devicePixelRatio || 1;
    const cfgScale = (RendererConfig && typeof RendererConfig.rendererScale === 'number') ? RendererConfig.rendererScale : 1;
    const dpr = baseDpr * cfgScale;
    const bounds = getDefaultBounds();
    canvas.style.width = `${bounds.W}px`;
    canvas.style.height = `${bounds.H}px`;
    canvas.width = Math.round(bounds.W * dpr);
    canvas.height = Math.round(bounds.H * dpr);
  }

  fitCanvasToWindow();
  window.addEventListener('resize', fitCanvasToWindow);

  // Dev-only renderer scale slider: wire up live changes
  try {
    const scaleRange = document.getElementById('rendererScaleRange');
    const scaleValue = document.getElementById('rendererScaleValue');
    if (scaleRange && scaleValue) {
      // initialize display from config
      scaleValue.textContent = String((RendererConfig.rendererScale || 1).toFixed(2));
      scaleRange.value = String(RendererConfig.rendererScale || 1);
      scaleRange.addEventListener('input', (ev) => {
        const v = parseFloat(ev.target.value || '1');
        RendererConfig.rendererScale = v;
        scaleValue.textContent = v.toFixed(2);
        // resize backing store to pick up new combined DPR and re-render visuals
        try { fitCanvasToWindow(); } catch (e) { /* ignore */ }
        // inform renderer that the scale/backing-store changed so it can
        // reapply transforms or update viewport. Prefer updateScale() if
        // available rather than re-initializing the whole renderer.
        try { if (renderer && typeof renderer.updateScale === 'function') renderer.updateScale(); else if (renderer && typeof renderer.init === 'function') renderer.init(); } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* dev controls optional */ }

  // Choose renderer per config; default to Canvas for dev
  let renderer;
  const pref = getPreferredRenderer();
  if (pref === 'webgl') {
    try {
      const w = new WebGLRenderer(canvas);
      if (w && w.init && w.init()) renderer = w;
    } catch (e) { /* fall through to canvas */ }
  }
  if (!renderer) {
    renderer = new CanvasRenderer(canvas);
    renderer.init && renderer.init();
  }

  // Ensure renderer re-initializes its backing-store transform when the
  // window resizes (fitCanvasToWindow updates canvas.width/height). We add
  // a resize listener here after the renderer exists so it can update its
  // internal pixelRatio/transform to match the new backing store size.
  try {
    window.addEventListener('resize', () => {
      try { fitCanvasToWindow(); } catch (e) {}
      try { if (renderer && typeof renderer.init === 'function') renderer.init(); } catch (e) {}
    });
  } catch (e) {}

  const gm = createGameManager({ renderer, canvas });

  // Listen for manager-level reinforcement events. createGameManager now
  // exposes a small `on(event, cb)` API that forwards worker messages and
  // also emits events for main-thread fallback reinforcements.
  try {
    if (gm && typeof gm.on === 'function') {
      gm.on('reinforcements', (msg) => {
        const list = (msg && msg.spawned) || [];
        const types = list.map(s => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(', ')})`;
        if (ui.stats) ui.stats.textContent = `${ui.stats.textContent} | ${summary}`;
        else console.info(summary);
      });
    }
  } catch (e) { /* ignore */ }

  // show whether simulation is running in a worker (diagnostic)
  const workerIndicator = rootDocument.getElementById('workerIndicator');
  if (workerIndicator) {
    // initial set and authoritative update using the manager's API
    try {
      workerIndicator.textContent = gm.isWorker() ? 'Worker' : 'Main';
      // listen for animation frames and refresh indicator so UI updates once workerReady flips
      (function refresh() { workerIndicator.textContent = gm.isWorker() ? 'Worker' : 'Main'; requestAnimationFrame(refresh); }());
    } catch (e) {
      // fallback: show unknown
      workerIndicator.textContent = 'Unknown';
    }
  }

  ui.startPause.addEventListener('click', () => {
    if (gm.isRunning()) { gm.pause(); ui.startPause.textContent = '▶ Start'; }
    else { gm.start(); ui.startPause.textContent = '⏸ Pause'; }
  });
  ui.reset.addEventListener('click', () => gm.reset());
  ui.addRed.addEventListener('click', () => gm.spawnShip('red'));
  ui.addBlue.addEventListener('click', () => gm.spawnShip('blue'));
  ui.seedBtn.addEventListener('click', () => gm.reseed());
  ui.formationBtn.addEventListener('click', () => gm.formFleets());
  // wire continuous checkbox if present
  if (ui.continuousCheckbox) {
    ui.continuousCheckbox.addEventListener('change', (ev) => {
      const v = !!ev.target.checked;
      if (gm && typeof gm.setContinuousEnabled === 'function') gm.setContinuousEnabled(v);
    });
  }

  // basic UI update loop
  function uiTick() {
    const s = gm.snapshot();
    ui.redScore.textContent = `Red ${gm.score.red}`;
    ui.blueScore.textContent = `Blue ${gm.score.blue}`;
    // show ships by team counts for easier diagnostics
    const redCount = s.ships.filter((sh) => sh.team === 'red').length;
    const blueCount = s.ships.filter((sh) => sh.team === 'blue').length;
    ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}`;
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
