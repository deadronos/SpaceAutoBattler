// Minimal main.js - bundler-friendly entry that wires UI to game manager and renderer
import { createGameManager } from './gamemanager.js';
import { CanvasRenderer } from './canvasrenderer.js';
import { WebGLRenderer } from './webglrenderer.js';
// JSDoc typedefs for editor/type-checking only
/**
 * @typedef {import('./types').RendererConfig} RendererConfig
 * @typedef {import('./types').DisplayConfig} DisplayConfig
 */
import { getDefaultBounds } from './config/displayConfig';
import { getPreferredRenderer, RendererConfig } from './config/rendererConfig';

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

  // Initialize stats text early so test harnesses (Playwright) can locate
  // the element immediately after DOMContentLoaded. uiTick will keep this
  // updated on animation frames.
  try { if (ui.stats) ui.stats.textContent = 'Ships: 0 (R:0 B:0) Bullets: 0'; } catch (e) {}

  function fitCanvasToWindow() {
    const baseDpr = window.devicePixelRatio || 1;
    const cfgScale = (RendererConfig && typeof RendererConfig.rendererScale === 'number') ? RendererConfig.rendererScale : 1;
    const bounds = getDefaultBounds();
    // To implement a visible "zoom" while preserving crispness on high-DPI
    // screens we change the CSS size (logical pixels) by the rendererScale and
    // keep the backing store at CSS_size * devicePixelRatio. This ensures the
    // canvas appears larger/smaller (zoom) while still rendering at device
    // pixel density.
    const cssW = Math.round(bounds.W * cfgScale);
    const cssH = Math.round(bounds.H * cfgScale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * baseDpr);
    canvas.height = Math.round(cssH * baseDpr);
  }

  fitCanvasToWindow();
  window.addEventListener('resize', fitCanvasToWindow);

  // Dev-only renderer scale slider: wire up live changes
  try {
    const scaleRange = document.getElementById('rendererScaleRange');
    const scaleValue = document.getElementById('rendererScaleValue');
    if (scaleRange && scaleValue) {
      try { console.debug && console.debug('startApp: renderer scale controls present, initial=', RendererConfig.rendererScale); } catch (e) {}
      // initialize display from config
      scaleValue.textContent = String((RendererConfig.rendererScale || 1).toFixed(2));
      scaleRange.value = String(RendererConfig.rendererScale || 1);
      scaleRange.addEventListener('input', (ev) => {
        const v = parseFloat(ev.target.value || '1');
        try { console.debug && console.debug('rendererScaleRange input ->', v); } catch (e) {}
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

  // Prefer main-thread simulation when running on local/dev hosts so tests
  // and Playwright can deterministically interact with the manager. When
  // deployed or served from a remote host, the manager will use a worker.
  let useWorkerFlag = true;
  try {
    const host = (location && location.hostname) || '';
    if (host === '127.0.0.1' || host === 'localhost') useWorkerFlag = false;
  } catch (e) { /* ignore */ }
  // ensure a stable window.gm object exists early for tests/debugging
  try { if (typeof window !== 'undefined') window.gm = window.gm || {}; } catch (e) {}

  const gm = createGameManager({ renderer, canvas, useWorker: useWorkerFlag });

  // copy manager methods onto window.gm (don't replace the object to keep references stable)
  try {
    if (typeof window !== 'undefined' && window.gm) {
      Object.assign(window.gm, gm);
      try { console.info('window.gm initialized'); } catch (e) {}
    }
  } catch (e) { /* ignore */ }

  // In local/dev mode (no worker) automatically enable continuous reinforcements
  // and step once so Playwright / automated tests can observe reinforcement UI
  try {
    // Only auto-enable continuous reinforcements for automated tests.
    // Local manual runs should not be forced into rapid reinforcements which
    // can confuse debugging. Tests (Playwright) explicitly call the GM API
    // to enable continuous mode and set the interval. To opt-in here, set
    // the query param `?autotest=1` when opening the page or set
    // `window.__AUTO_REINFORCE_DEV__ = true` before startApp() is called.
    const host = (location && location.hostname) || '';
    const urlParams = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(location.search) : null;
    const autotest = (urlParams && urlParams.get('autotest') === '1') || !!(window && window.__AUTO_REINFORCE_DEV__);
    if ((host === '127.0.0.1' || host === 'localhost') && autotest) {
      try { if (gm && typeof gm.setContinuousEnabled === 'function') gm.setContinuousEnabled(true); } catch (e) {}
      try { if (gm && typeof gm.setReinforcementInterval === 'function') gm.setReinforcementInterval(0.01); } catch (e) {}
      try { if (gm && typeof gm.stepOnce === 'function') gm.stepOnce(0.02); } catch (e) {}
    }
  } catch (e) { /* ignore */ }

  // Listen for manager-level reinforcement events. createGameManager now
  // exposes a small `on(event, cb)` API that forwards worker messages and
  // also emits events for main-thread fallback reinforcements.
  // Reinforcement summaries are displayed briefly in the UI. We store the
  // latest summary in a variable and include it in the regular uiTick loop
  // so it isn't clobbered by the periodic stats update.
  let lastReinforcementSummary = '';
  try {
    if (gm && typeof gm.on === 'function') {
      gm.on('reinforcements', (msg) => {
        const list = (msg && msg.spawned) || [];
        const types = list.map(s => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(', ')})`;
        lastReinforcementSummary = summary;
        // clear after a short time so UI doesn't permanently grow
        try { setTimeout(() => { lastReinforcementSummary = ''; }, 3000); } catch (e) {}
        // also log for telemetry
          console.info(summary);
          try { if (ui && ui.stats) ui.stats.textContent = `${ui.stats.textContent} | ${summary}`; } catch (e) {}
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
    ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}` + (lastReinforcementSummary ? ` | ${lastReinforcementSummary}` : '');
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
