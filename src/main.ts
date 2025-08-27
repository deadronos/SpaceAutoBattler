// This allows the build to treat the app as TypeScript while we incrementally port internals.
// main.ts — TypeScript entrypoint (ported from main.js). Uses TS imports so
// the module graph resolves to .ts sources during migration.
import { createGameManager } from "./gamemanager";
import { makeInitialState } from "./entities";
import type { GameState } from "./types";
import { CanvasRenderer } from "./canvasrenderer";
import { WebGLRenderer } from "./webglrenderer";
import { getDefaultBounds } from "./config/simConfig";
import { SIM } from "./config/simConfig";
import { getPreferredRenderer, RendererConfig } from "./config/rendererConfig";
import { getRuntimeShipConfigSafe } from "./config/runtimeConfigResolver";
// Ensure svgRenderer module evaluates and installs its global bridge at startup.
// This side-effect import makes globalThis.__SpaceAutoBattler_svgRenderer available
// before renderers attempt to consult it (helps with cross-bundle cache discovery).
import "./assets/svgRenderer";
import svgRenderer from "./assets/svgRenderer";
import AssetsConfig from "./config/assets/assetsConfig";

// Allow temporary extension of window.gm used by the app during migration.
declare global {
  interface Window {
    gm?: any;
  }
}

export async function startApp(rootDocument: Document = document) {
  // Instantiate canonical GameState at startup
  const gameState: GameState = makeInitialState();

  let canvas = rootDocument.getElementById("world") as HTMLCanvasElement | null;
  // If the host document doesn't already have a canvas#world (some DOM emulators
  // may provide a fresh document per test), create one so renderers can attach.
  if (!canvas) {
    try {
      const el = rootDocument.createElement("canvas");
      el.id = "world";
      rootDocument.body.appendChild(el);
      canvas = el as HTMLCanvasElement;
    } catch (e) {
      canvas = null;
    }
  }
  const ui: any = {
    startPause: rootDocument.getElementById("startPause"),
    reset: rootDocument.getElementById("reset"),
    addRed: rootDocument.getElementById("addRed"),
    addBlue: rootDocument.getElementById("addBlue"),
    toggleTrails: rootDocument.getElementById("toggleTrails"),
    speed: rootDocument.getElementById("speed"),
    redScore: rootDocument.getElementById("redScore"),
    blueScore: rootDocument.getElementById("blueScore"),
    stats: rootDocument.getElementById("stats"),
    continuousCheckbox: rootDocument.getElementById("continuousCheckbox"),
    seedBtn: rootDocument.getElementById("seedBtn"),
    formationBtn: rootDocument.getElementById("formationBtn"),
  };

  try {
    if (ui.stats) ui.stats.textContent = "Ships: 0 (R:0 B:0) Bullets: 0";
  } catch (e) {}

  // Always use fixed logical bounds for simulation/game loop
  const LOGICAL_BOUNDS = getDefaultBounds();

  // --- Disposable tracking helpers to avoid memory leaks ---
  const disposables: Array<() => void> = [];
  let uiRaf: number | null = null;
  let workerIndicatorRaf: number | null = null;
  const pendingTimers = new Set<number>();
  let isUiTickRunning = false;

  function addListener(
    target: EventTarget | null,
    type: string,
    handler: EventListenerOrEventListenerObject,
  ) {
    if (!target) return;
    try {
      target.addEventListener(type, handler as EventListener);
      disposables.push(() => {
        try {
          target.removeEventListener(type, handler as EventListener);
        } catch (e) {}
      });
    } catch (e) {}
  }

  function clearAllTimers() {
    for (const id of Array.from(pendingTimers)) {
      try {
        clearTimeout(id as unknown as number);
      } catch (e) {}
      pendingTimers.delete(id);
    }
  }

  // Only update backing store when renderScale changes
  function updateCanvasBackingStore() {
    const dpr = window.devicePixelRatio || 1;
    const renderScale =
      RendererConfig && typeof (RendererConfig as any).renderScale === "number"
        ? (RendererConfig as any).renderScale
        : 1;
    const logicalW = LOGICAL_BOUNDS.W;
    const logicalH = LOGICAL_BOUNDS.H;
    if (canvas) {
      const bufferW = Math.round((logicalW * renderScale) / dpr);
      const bufferH = Math.round((logicalH * renderScale) / dpr);
      canvas.width = bufferW;
      canvas.height = bufferH;
      canvas.style.width = bufferW + "px";
      canvas.style.height = bufferH + "px";
      const dimsEl = document.getElementById("rendererDims");
      if (dimsEl) {
        dimsEl.textContent = `${canvas.width} x ${canvas.height} px @ ${dpr}x`;
      }
    }
    (RendererConfig as any)._renderScale = renderScale;
    (RendererConfig as any)._offsetX = 0;
    (RendererConfig as any)._offsetY = 0;
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal) scaleVal.textContent = renderScale.toFixed(2);
  }

  // Only update CSS size on window resize
  function fitCanvasToWindow() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const bufferW = canvas ? canvas.width : LOGICAL_BOUNDS.W;
    const bufferH = canvas ? canvas.height : LOGICAL_BOUNDS.H;
    // Compute scale to fit buffer into window, preserving aspect ratio
    const scale = Math.min(winW / bufferW, winH / bufferH);
    const scaledW = bufferW * scale;
    const scaledH = bufferH * scale;
    const offsetX = Math.round((winW - scaledW) / 2);
    const offsetY = Math.round((winH - scaledH) / 2);
    if (canvas) {
      // Set width/height to buffer size, but use transform for scaling
      canvas.style.width = `${bufferW}px`;
      canvas.style.height = `${bufferH}px`;
      canvas.style.position = "absolute";
      canvas.style.left = `${offsetX}px`;
      canvas.style.top = `${offsetY}px`;
      canvas.style.transformOrigin = "top left";
      canvas.style.transform = `scale(${scale})`;
    }
    // Prevent scrollbars
    document.body.style.overflow = "hidden";
  }
  // Renderer scale slider and dynamic scaling wiring
  const scaleSlider = rootDocument.getElementById("rendererScaleRange");
  const dynamicCheckbox = rootDocument.getElementById("dynamicScaleCheckbox");
  let internalScaleUpdate = false;
  if (scaleSlider) {
    const onScaleInput = (ev: any) => {
      if (internalScaleUpdate) return; // ignore internal updates
      const val = parseFloat(ev.target.value);
      if (!isNaN(val)) {
        (RendererConfig as any).renderScale = val;
        (RendererConfig as any).dynamicScaleEnabled = false;
        if (dynamicCheckbox)
          (dynamicCheckbox as HTMLInputElement).checked = false;
        updateCanvasBackingStore();
        fitCanvasToWindow();
      }
    };
    addListener(scaleSlider, "input", onScaleInput);
    // Set initial value display
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal)
      scaleVal.textContent = (scaleSlider as HTMLInputElement).value;
    // Ensure initial fit-to-window calculation uses current scale
    updateCanvasBackingStore();
    fitCanvasToWindow();
  }
  if (dynamicCheckbox) {
    const onDynamicChange = (ev: any) => {
      const enabled = !!ev.target.checked;
      (RendererConfig as any).dynamicScaleEnabled = enabled;
    };
    addListener(dynamicCheckbox, "change", onDynamicChange);
    (dynamicCheckbox as HTMLInputElement).checked = !!(RendererConfig as any)
      .dynamicScaleEnabled;
  }

  fitCanvasToWindow();
  addListener(window, "resize", fitCanvasToWindow);

  let renderer: any = null;
  const pref = getPreferredRenderer();
  if (canvas) {
    if (pref === "webgl") {
      try {
        const w = new WebGLRenderer(canvas);
        if (w && w.init && w.init()) renderer = w;
      } catch (e) {}
    }
    if (!renderer) {
      try {
        renderer = new CanvasRenderer(canvas);
        renderer.init && renderer.init();
      } catch (e) {
        renderer = null;
      }
    }
  }
  // Preload all assets if renderer supports it
  if (renderer && typeof renderer.preloadAllAssets === "function") {
    try {
      renderer.preloadAllAssets();
    } catch (e) {}
  }
  // Kick off a lightweight pre-warm of the svg raster cache so synchronous
  // lookups performed by svgLoader.getCachedHullCanvasSync can succeed on
  // first draw. Only run in browser environments.
  try {
    if (typeof window !== 'undefined' && svgRenderer && typeof svgRenderer.prewarmAssets === 'function') {
      try {
  const assetsConfig = AssetsConfig || (globalThis as any).AssetsConfig || {};
  const svgAssets = assetsConfig.svgAssets || {};
        // Pick a small set of commonly used ship types (prioritize fighter)
        const allKeys = Object.keys(svgAssets);
        const keys = ['fighter', ...allKeys.filter(k => k !== 'fighter')].slice(0, 8);
        // Gather declared team colors
        const teams = (globalThis as any).TeamsConfig && (globalThis as any).TeamsConfig.teams ? (globalThis as any).TeamsConfig.teams : {};
        const teamColors: string[] = [];
        for (const tName of Object.keys(teams)) {
          const t = teams[tName]; if (t && t.color) teamColors.push(t.color);
        }
        if (teamColors.length === 0) {
          const p = assetsConfig.palette || {};
          if (p.shipHull) teamColors.push(p.shipHull);
          if (p.shipAccent) teamColors.push(p.shipAccent);
        }
        // Don't await on startup; let it run in background but call to ensure
        // module loads and global bridge is used early. Prefer the global
        // bridge object so the exact same raster cache instance is populated
        // that svgLoader.getCachedHullCanvasSync will consult.
        try {
          const g = (globalThis as any).__SpaceAutoBattler_svgRenderer;
          const shouldAwait = typeof (globalThis as any).__AWAIT_SVG_PREWARM !== 'undefined' ? !!(globalThis as any).__AWAIT_SVG_PREWARM : false;
          if (g && typeof g.prewarmAssets === 'function') {
            try {
              const res = g.prewarmAssets(keys, teamColors, 128, 128);
              if (shouldAwait && res && typeof res.then === 'function') {
                // allow callers/tests to opt into waiting for rasterization
                await res.catch(() => {});
              }
            } catch (e) {}
          } else {
            const res = svgRenderer.prewarmAssets(keys, teamColors);
            if (shouldAwait && res && typeof res.then === 'function') {
              await res.catch(() => {});
            }
          }
        } catch (e) {
          try { svgRenderer.prewarmAssets(keys, teamColors).catch(() => {}); } catch (ee) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
  // If we don't have a canvas (or renderer failed), provide a minimal no-op renderer
  if (!renderer) {
    renderer = {
      type: "noop",
      init: () => false,
      renderState: (_: any) => {},
      isRunning: () => false,
    };
  }

  try {
    window.gm = window.gm || {};
  } catch (e) {}
  // Pass fixed logical bounds and canonical GameState to game manager
  const gm = createGameManager({ renderer, useWorker: false, seed: 12345 });
  if (gm && gm._internal) {
    gm._internal.bounds = LOGICAL_BOUNDS;
    gm._internal.state = gameState;
  }
  try {
    if (typeof window !== "undefined" && (window as any).gm)
      Object.assign((window as any).gm, gm);
    // Expose renderer for debugging on localhost only. This allows us to
    // inspect caches and mapping at runtime without permanently leaking
    // internals in production bundles.
    try {
      const host = (location && location.hostname) || "";
      if (host === "127.0.0.1" || host === "localhost") {
        try {
          // Attach a non-enumerable debug handle
          Object.defineProperty(window, "__renderer", {
            value: renderer,
            writable: false,
            configurable: true,
            enumerable: false,
          });
        } catch (e) {
          try {
            (window as any).__renderer = renderer;
          } catch (err) {}
        }
      }
    } catch (e) {}
  } catch (e) {}

  // Initialize dev overlay (toggle with ?devShipTable=1)
  try {
    if (typeof window !== "undefined") {
      // Enable overlay in non-production builds or when URL param present
      // Runtime-only check: enable overlay on localhost or when URL param devShipTable=1
      const host = (location && location.hostname) || "";
      const urlParams =
        typeof URLSearchParams !== "undefined"
          ? new URLSearchParams(location.search)
          : null;
      const enabled =
        host === "127.0.0.1" ||
        host === "localhost" ||
        urlParams?.get("devShipTable") === "1";
      if (enabled) {
        // Lazy import to avoid affecting production bundles when tree-shaken
        import("./dev/shipPipelineOverlay")
          .then((m) => {
            try {
              m.default && m.default();
            } catch (e) {}
          })
          .catch((e) => {
            console.warn("Failed to load dev overlay", e);
          });
      }
    }
  } catch (e) {}

  // Speed multiplier logic
  let simSpeedMultiplier = 1;
  if (ui.speed) {
    const onSpeedClick = () => {
      simSpeedMultiplier =
        simSpeedMultiplier >= 4 ? 0.25 : simSpeedMultiplier * 2;
      ui.speed.textContent = `Speed: ${simSpeedMultiplier}×`;
    };
    addListener(ui.speed, "click", onSpeedClick);
    ui.speed.textContent = `Speed: ${simSpeedMultiplier}×`;
  }

  // Patch stepOnce to use multiplier
  if (gm && typeof gm.stepOnce === "function") {
    const origStepOnce = gm.stepOnce.bind(gm);
    // Use canonical SIM.DT_MS (millisecond timestep) converted to seconds
    // as the default step size so the UI multiplier wraps the same base dt
    // the simulation run-loop uses. This prevents hard-coded mismatches.
    gm.stepOnce = (dt: number = SIM.DT_MS / 1000) =>
      origStepOnce(dt * simSpeedMultiplier);
  }

  // Fleet formation logic
  if (ui.formationBtn) {
    const onFormationClick = () => {
      if (gm && typeof gm.formFleets === "function") {
        gm.formFleets();
      }
    };
    addListener(ui.formationBtn, "click", onFormationClick);
  }

  // Engine trail UI toggle state
  let engineTrailsEnabled = true;
  gameState.engineTrailsEnabled = engineTrailsEnabled;
  if (ui.toggleTrails) {
    const onToggleTrails = () => {
      engineTrailsEnabled = !engineTrailsEnabled;
      gameState.engineTrailsEnabled = engineTrailsEnabled;
      ui.toggleTrails.textContent = engineTrailsEnabled
        ? "☄ Trails: On"
        : "☄ Trails: Off";
    };
    addListener(ui.toggleTrails, "click", onToggleTrails);
    ui.toggleTrails.textContent = engineTrailsEnabled
      ? "☄ Trails: On"
      : "☄ Trails: Off";
  }

  try {
    const host = (location && location.hostname) || "";
    const urlParams =
      typeof URLSearchParams !== "undefined"
        ? new URLSearchParams(location.search)
        : null;
    const autotest =
      (urlParams && urlParams.get("autotest") === "1") ||
      !!(window as any).__AUTO_REINFORCE_DEV__;
    if ((host === "127.0.0.1" || host === "localhost") && autotest) {
      try {
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(true);
      } catch (e) {}
      try {
        if (gm && typeof gm.setReinforcementInterval === "function")
          gm.setReinforcementInterval(0.01);
      } catch (e) {}
      try {
        if (gm && typeof gm.stepOnce === "function") gm.stepOnce(0.02);
      } catch (e) {}
    }
  } catch (e) {}

  let lastReinforcementSummary = "";
  let reinforcementsHandler: ((msg: any) => void) | null = null;
  try {
    if (gm && typeof gm.on === "function") {
      reinforcementsHandler = (msg: any) => {
        const list = (msg && msg.spawned) || [];
        const types = list.map((s: any) => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(", ")})`;
        lastReinforcementSummary = summary;
        try {
          const tid = setTimeout(() => {
            lastReinforcementSummary = "";
          }, 3000);
          pendingTimers.add(tid as unknown as number);
        } catch (e) {}
        try {
          if (ui && ui.stats)
            ui.stats.textContent = `${ui.stats.textContent} | ${summary}`;
        } catch (e) {}
      };
      gm.on("reinforcements", reinforcementsHandler);
    }
  } catch (e) {}

  const workerIndicator = rootDocument.getElementById("workerIndicator");
  let toastContainer = rootDocument.getElementById("toastContainer");
  if (!toastContainer) {
    try {
      toastContainer = rootDocument.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.style.position = "fixed";
      toastContainer.style.right = "16px";
      toastContainer.style.top = "16px";
      toastContainer.style.zIndex = "9999";
      toastContainer.style.pointerEvents = "none";
      rootDocument.body.appendChild(toastContainer);
      disposables.push(() => {
        try {
          if (toastContainer && toastContainer.parentNode)
            toastContainer.parentNode.removeChild(toastContainer);
        } catch (e) {}
      });
    } catch (e) {
      toastContainer = null;
    }
  }

  function showToast(msg: string, opts: any = {}) {
    try {
      if (!toastContainer) return;
      const ttl = typeof opts.ttl === "number" ? opts.ttl : 2000;
      const el = rootDocument.createElement("div");
      el.style.background = "rgba(20,20,30,0.9)";
      el.style.color = "#fff";
      el.style.padding = "8px 12px";
      el.style.marginTop = "6px";
      el.style.borderRadius = "6px";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
      el.style.fontFamily = "sans-serif";
      el.style.fontSize = "13px";
      el.style.pointerEvents = "auto";
      el.textContent = msg;
      toastContainer.appendChild(el);
      const tid = setTimeout(() => {
        try {
          el.style.transition = "opacity 300ms ease";
          el.style.opacity = "0";
        } catch (e) {}
        setTimeout(() => {
          try {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } catch (err) {}
        }, 350);
      }, ttl);
      pendingTimers.add(tid as unknown as number);
    } catch (e) {}
  }

  let levelupHandler: ((m: any) => void) | null = null;
  try {
    if (gm && typeof gm.on === "function") {
      levelupHandler = (m: any) => {
        try {
          const ship = (m && m.ship) || null;
          const lvl =
            (m && m.newLevel) || (m && m.newLevel === 0 ? 0 : undefined);
          const who = ship && ship.team ? `${ship.team} ship` : "Ship";
          const msg = `${who} leveled up to ${lvl}`;
          showToast(msg, { ttl: 2200 });
        } catch (e) {}
      };
      gm.on("levelup", levelupHandler);
    }
  } catch (e) {}

  if (workerIndicator) {
    try {
      const refresh = () => {
        try {
          workerIndicator.textContent =
            gm.isWorker && gm.isWorker() ? "Worker" : "Main";
        } catch (e) {}
        try {
          workerIndicatorRaf = requestAnimationFrame(refresh);
        } catch (e) {
          workerIndicatorRaf = null;
        }
      };
      refresh();
    } catch (e) {
      workerIndicator.textContent = "Unknown";
    }
  }

  try {
    if (ui.startPause)
      addListener(ui.startPause, "click", () => {
        if (gm.isRunning()) {
          gm.pause();
          ui.startPause.textContent = "▶ Start";
        } else {
          gm.start();
          ui.startPause.textContent = "⏸ Pause";
        }
      });
  } catch (e) {}
  try {
    if (ui.reset) addListener(ui.reset, "click", () => gm.reset());
  } catch (e) {}
  // Populate ship type selector (for deterministic, seeded spawns)
  try {
    const cfg = getRuntimeShipConfigSafe();
    const selectEl = rootDocument.getElementById(
      "shipTypeSelect",
    ) as HTMLSelectElement | null;
    if (selectEl && cfg) {
      // Clear existing
      selectEl.innerHTML = "";
      for (const key of Object.keys(cfg)) {
        try {
          const opt = rootDocument.createElement("option");
          opt.value = key;
          opt.textContent = key;
          selectEl.appendChild(opt);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Generic spawn helper that respects seeded RNG via gm.spawnShip's internal use of srandom
  function spawnSelected(team: string) {
    try {
      const selectEl = rootDocument.getElementById(
        "shipTypeSelect",
      ) as HTMLSelectElement | null;
      const selectedType = selectEl ? selectEl.value : null;
      // If gm.spawnShip supports (team, type) signature, prefer that
      try {
        if (gm && typeof gm.spawnShip === "function") {
          // Try calling with (team, type) if supported
          if (selectedType) {
            try {
              const maybe = (gm as any).spawnShip(team, selectedType);
              if (maybe) return maybe;
            } catch (e) {
              // ignore and fall back
            }
          }
          const ship = gm.spawnShip(team);
          if (ship && selectedType) {
            try {
              ship.type = selectedType;
              // attach config snapshot if available
              try {
                const scfg = getRuntimeShipConfigSafe();
                if (scfg && scfg[selectedType])
                  (ship as any)._config = scfg[selectedType];
              } catch (e) {}
            } catch (e) {}
          }
          return ship;
        }
      } catch (e) {}
    } catch (e) {}
    return null;
  }

  try {
    if (ui.addRed) addListener(ui.addRed, "click", () => spawnSelected("red"));
  } catch (e) {}
  try {
    if (ui.addBlue)
      addListener(ui.addBlue, "click", () => spawnSelected("blue"));
  } catch (e) {}
  function onSeedBtnClick() {
    try {
      const raw =
        typeof window !== "undefined" && typeof window.prompt === "function"
          ? window.prompt("Enter new seed (leave blank for random):", "")
          : null;
      if (raw == null) return;
      const trimmed = String(raw).trim();
      if (trimmed === "") {
        try {
          gm.reseed();
          showToast("Reseeded with random seed");
        } catch (e) {}
        return;
      }
      const asNum = Number(trimmed);
      if (!Number.isFinite(asNum) || Math.floor(asNum) !== asNum) {
        try {
          showToast("Invalid seed. Please enter an integer.");
        } catch (e) {}
        return;
      }
      try {
        gm.reseed(asNum >>> 0);
        showToast(`Reseeded with ${asNum >>> 0}`);
      } catch (e) {}
    } catch (e) {}
  }
  try {
    if (ui.seedBtn) addListener(ui.seedBtn, "click", onSeedBtnClick);
  } catch (e) {}
  // try { ui.formationBtn.addEventListener('click', () => gm.formFleets()); } catch (e) {}
  try {
    if (ui.continuousCheckbox) {
      addListener(ui.continuousCheckbox, "change", (ev: any) => {
        const v = !!ev.target.checked;
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(v);
      });
    }
  } catch (e) {}

  function uiTick() {
    if (isUiTickRunning) return; // Prevent multiple loops
    isUiTickRunning = true;
    const startTick = performance.now();
    let skipRender = false;
    try {
      const s = gm.snapshot();
      ui.redScore.textContent = `Red ${gm.score.red}`;
      ui.blueScore.textContent = `Blue ${gm.score.blue}`;
      const redCount = (s.teamCounts && (s.teamCounts as any).red) || 0;
      const blueCount = (s.teamCounts && (s.teamCounts as any).blue) || 0;
      ui.stats.textContent =
        `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}` +
        (lastReinforcementSummary ? ` | ${lastReinforcementSummary}` : "");
    } catch (e) {}
    const endTick = performance.now();
    const tickTime = endTick - startTick;
    if (tickTime > SIM.DT_MS) {
      skipRender = true;
    }
    // --- Dynamic buffer scaling logic ---
    const dynamicEnabled = !!(RendererConfig as any).dynamicScaleEnabled;
    const scaleSliderEl = rootDocument.getElementById(
      "rendererScaleRange",
    ) as HTMLInputElement;
    const scaleValEl = rootDocument.getElementById("rendererScaleValue");
    // Track frame time
    const now = performance.now();
    (RendererConfig as any)._lastUiTick =
      (RendererConfig as any)._lastUiTick || now;
    const dt = now - (RendererConfig as any)._lastUiTick;
    (RendererConfig as any)._lastUiTick = now;
    (RendererConfig as any).lastFrameTime = dt;
    // Score frame time
    let frameScore = "green";
    if (dt > 33) frameScore = "red";
    else if (dt > 20) frameScore = "yellow";
    (RendererConfig as any).frameScore = frameScore;
    // Color slider value for feedback
    if (scaleValEl) {
      scaleValEl.style.color =
        frameScore === "green"
          ? "#4caf50"
          : frameScore === "yellow"
            ? "#ffd600"
            : "#ff1744";
    }
    // Dynamic scaling logic
    if (dynamicEnabled && scaleSliderEl) {
      let scale = (RendererConfig as any).renderScale;
      // If frame is slow, reduce scale; if fast, increase scale
      if (frameScore === "red" && scale > 0.25)
        scale = Math.max(0.25, scale - 0.05);
      else if (frameScore === "green" && scale < 2.0)
        scale = Math.min(2.0, scale + 0.01);
      // Only update if changed
      if (scale !== (RendererConfig as any).renderScale) {
        (RendererConfig as any).renderScale = scale;
        internalScaleUpdate = true;
        scaleSliderEl.value = scale.toFixed(2);
        if (scaleValEl) scaleValEl.textContent = scale.toFixed(2);
        fitCanvasToWindow();
        internalScaleUpdate = false;
      }
    }
    if (!skipRender) {
      try {
        uiRaf = requestAnimationFrame(() => {
          isUiTickRunning = false;
          uiTick();
        });
      } catch (e) {
        uiRaf = null;
        isUiTickRunning = false;
      }
    } else {
      // Only update simulation, skip rendering for this frame
      const tid = setTimeout(() => {
        isUiTickRunning = false;
        uiTick();
      }, SIM.DT_MS);
      if (typeof tid === "number") pendingTimers.add(tid as number);
    }
  }
  uiRaf = requestAnimationFrame(uiTick);

  function dispose() {
    // First, destroy game manager resources (worker, handlers)
    try {
      if (gm && typeof gm.destroy === "function") gm.destroy();
    } catch (e) {}

    // Stop the game manager run loop
    try {
      if (gm && typeof gm.pause === "function") gm.pause();
    } catch (e) {}

    // Unregister gm-level listeners we added
    try {
      if (gm && typeof gm.off === "function") {
        if (reinforcementsHandler)
          gm.off("reinforcements", reinforcementsHandler);
        if (levelupHandler) gm.off("levelup", levelupHandler);
      }
    } catch (e) {}

    // Cancel RAFs started here
    if (uiRaf != null) {
      try {
        cancelAnimationFrame(uiRaf);
      } catch (e) {}
      uiRaf = null;
    }
    isUiTickRunning = false;
    if (workerIndicatorRaf != null) {
      try {
        cancelAnimationFrame(workerIndicatorRaf);
      } catch (e) {}
      workerIndicatorRaf = null;
    }

    // Clear timers
    try {
      clearAllTimers();
    } catch (e) {}

    // Run registered disposables (removes DOM listeners, etc)
    for (const fn of disposables.slice()) {
      try {
        fn();
      } catch (e) {}
    }
    disposables.length = 0;

    // Optionally clear global gm reference (defensive)
    try {
      if (typeof window !== "undefined" && (window as any).gm) {
        // Only remove properties we assigned (don't blow away other properties)
        try {
          delete (window as any).gm;
        } catch (e) {}
      }
    } catch (e) {}
  }

  return { gm, renderer, dispose };
}

if (typeof window !== "undefined") {
  let appInstance: { gm: any; renderer: any; dispose: () => void } | null =
    null;
  function safeStartApp(doc: Document) {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
    startApp(doc).then((instance) => {
      appInstance = instance;
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => safeStartApp(document));
  else safeStartApp(document);
  window.addEventListener("beforeunload", () => {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
  });
}

export default startApp;
