// Helper: get SVG asset or warn if missing
export function getSvgAssetOrWarn(type: string): string {
  const assetsConfig =
    typeof globalThis !== "undefined" && (globalThis as any).AssetsConfig
      ? (globalThis as any).AssetsConfig
      : undefined;
  const svg = assetsConfig?.svgAssets?.[type] ?? "";
  if (!svg) {
    try {
      const _isProd =
        (typeof process !== "undefined" &&
          process.env &&
          process.env.NODE_ENV === "production") ||
        (typeof (globalThis as any).NODE_ENV !== "undefined" &&
          (globalThis as any).NODE_ENV === "production");
      if (!_isProd) {
        console.warn(
          `[CanvasRenderer] WARNING: SVG asset for type '${type}' is missing or empty.`,
        );
      }
    } catch (e) {
      // ignore environment detection errors
    }
  }
  return svg;
}
// Imports required by the renderer (kept after helper to avoid import hoisting issues in some loaders)
import type { GameState } from "./types";
import {
  createExplosionEffect,
  resetExplosionEffect,
  createHealthHitEffect,
  resetHealthHitEffect,
  ExplosionEffect,
  HealthHitEffect,
} from "./entities";
import {
  acquireSprite,
  releaseSprite,
  acquireEffect,
  releaseEffect,
  makePooled,
} from "./pools";
import RendererConfig from "./config/rendererConfig";
import { getDefaultBounds } from "./config/simConfig";
import AssetsConfig, {
  getVisualConfig,
  getShipAsset,
  getBulletAsset,
  getTurretAsset,
  getEngineTrailConfig,
  getSpriteAsset,
} from "./config/assets/assetsConfig";
import * as svgLoader from "./assets/svgLoader";
import TeamsConfig from "./config/teamsConfig";
import TintedHullPool from "./pools/tintedHullPool";
import { getRuntimeShipConfigSafe, getDefaultShipTypeSafe } from "./config/runtimeConfigResolver";
function getShipConfigSafe() {
  return getRuntimeShipConfigSafe() || {};
}

// Helper: produce a mapping object that maps common SVG data-team-slot
// role names to the provided team color. Many SVGs use different role
// names (hull, primary, hangar, trim, etc.) — map them all so a single
// team color will recolor any of those slots.
function teamMapping(color: string) {
  return {
    primary: color,
    hull: color,
    trim: color,
    hangar: color,
    launch: color,
    engine: color,
    glow: color,
    turret: color,
    panel: color,
    secondary: color,
    accent: color,
    weapon: color,
    detail: color,
  } as Record<string, string>;
}

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null = null;
  bufferCanvas: HTMLCanvasElement;
  bufferCtx: CanvasRenderingContext2D | null = null;
  providesOwnLoop = false;
  type = "canvas";
  // ratio between backing store pixels and CSS (logical) pixels
  pixelRatio = 1;
  // cache for svg-extracted turret mountpoints in ship-local radius units
  _svgMountCache: Record<string, [number, number][]> | null = null;
  // cache for svg-extracted engine mountpoints in ship-local radius units
  _svgEngineMountCache: Record<string, [number, number][]> | null = null;
  // rasterized turret sprite cache: kind -> offscreen canvas
  _turretSpriteCache: Record<string, HTMLCanvasElement> | null = null;
  // rasterized hull-only SVG cache: shipType -> offscreen canvas
  _svgHullCache: Record<string, HTMLCanvasElement | undefined> = {};
  // tinted hull cache implemented as a per-team capped pool for canvases
  _tintedHullPool: TintedHullPool | null = null;
  // Backwards-compatible Map-like facade for tests that expect _tintedHullCache
  get _tintedHullCache(): Map<string, HTMLCanvasElement> {
    const self = this;
    // Minimal Map-like wrapper exposing iterable behaviour backed by _tintedHullPool
    class MapWrapper {
      [Symbol.toStringTag] = "Map";
      constructor() {}
      get size() {
        try {
          return self._tintedHullPool
            ? (self._tintedHullPool as any).size || 0
            : 0;
        } catch (e) {
          return 0;
        }
      }
      clear(): void {
        if (self._tintedHullPool) (self._tintedHullPool as any).clear();
      }
      delete(key: string): boolean {
        if (!self._tintedHullPool) return false;
        return !!(
          self._tintedHullPool.has(key) &&
          (self._tintedHullPool.delete(key), true)
        );
      }
      forEach(
        cb: (
          value: HTMLCanvasElement,
          key: string,
          map: Map<string, HTMLCanvasElement>,
        ) => void,
        thisArg?: any,
      ): void {
        if (!self._tintedHullPool) return;
        for (const k of (self._tintedHullPool as any).keys()) {
          const v = (self._tintedHullPool as any).get(k);
          cb.call(thisArg, v, k as string, this as any);
        }
      }
      get(key: string): HTMLCanvasElement | undefined {
        return self._tintedHullPool
          ? ((self._tintedHullPool as any).get(key) as
              | HTMLCanvasElement
              | undefined)
          : undefined;
      }
      has(key: string): boolean {
        return !!(
          self._tintedHullPool && (self._tintedHullPool as any).has(key)
        );
      }
      set(key: string, value: HTMLCanvasElement): this {
        self._setTintedCanvas(key, value);
        return this;
      }
      *entries(): IterableIterator<[string, HTMLCanvasElement]> {
        if (!self._tintedHullPool) return;
        for (const k of (self._tintedHullPool as any).keys()) {
          yield [
            k as string,
            (self._tintedHullPool as any).get(k) as HTMLCanvasElement,
          ];
        }
      }
      *keys(): IterableIterator<string> {
        if (!self._tintedHullPool) return;
        for (const k of (self._tintedHullPool as any).keys()) yield k as string;
      }
      *values(): IterableIterator<HTMLCanvasElement> {
        if (!self._tintedHullPool) return;
        for (const k of (self._tintedHullPool as any).keys())
          yield (self._tintedHullPool as any).get(k) as HTMLCanvasElement;
      }
      [Symbol.iterator](): IterableIterator<[string, HTMLCanvasElement]> {
        return this.entries();
      }
    }
    return new MapWrapper() as any;
  }

  // Clear the tinted hull cache (useful when palette/team colors change)
  clearTintedHullCache(): void {
    try {
      if (this._tintedHullPool) this._tintedHullPool.clear();
    } catch (e) {}
  }

  // Internal helper: set a tinted canvas in the Map and enforce LRU cap.
  private _setTintedCanvas(key: string, canvas: HTMLCanvasElement) {
    if (!this._tintedHullPool)
      this._tintedHullPool = new TintedHullPool({
        globalCap: 256,
        perTeamCap: 64,
      });
    this._tintedHullPool.set(key, canvas);
  }

  // Test helper: allow tests to inject entries deterministically without TS private access errors.
  // Kept separate so production code still uses private _setTintedCanvas.
  _testSetTintedCanvas(key: string, canvas: HTMLCanvasElement) {
    this._setTintedCanvas(key, canvas);
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Create offscreen buffer sized at logical map × renderer scale
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCtx = this.bufferCanvas.getContext("2d");
  }

  init(): boolean {
    this.ctx = this.canvas.getContext("2d");
    // If running in a test environment (DOM emulation) getContext may be unimplemented.
    // Provide a minimal no-op 2D context so renderState can still resize buffers and run logic.
    if (!this.ctx) {
      // create a lightweight no-op ctx that satisfies the subset used by the renderer
      const noop = () => {};
      const noOpCtx: any = {
        setTransform: noop,
        imageSmoothingEnabled: true,
        clearRect: noop,
        save: noop,
        restore: noop,
        fillRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        fill: noop,
        stroke: noop,
        arc: noop,
        translate: noop,
        rotate: noop,
        drawImage: noop,
        globalAlpha: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        lineWidth: 1,
        globalCompositeOperation: "source-over",
      };
      this.ctx = noOpCtx as unknown as CanvasRenderingContext2D;
    }
    this.bufferCtx = this.bufferCanvas.getContext("2d") || this.ctx;
    // bufferCtx must be present (either real or no-op) for renderState to proceed
    if (!this.bufferCtx) return false;
    // compute pixelRatio from renderScale only
    try {
      const renderScale =
        RendererConfig &&
        typeof (RendererConfig as any).renderScale === "number"
          ? (RendererConfig as any).renderScale
          : 1;
      this.pixelRatio = renderScale;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0); // No scaling here; only when compositing buffer
      this.ctx.imageSmoothingEnabled = true;
    } catch (e) {
      this.pixelRatio = 1;
    }
    // Kick off async preload of SVG assets to extract turret mountpoints.
    // Run async but don't block init; cache will populate when ready.
    try {
      // call and ignore promise errors to avoid breaking init
      (this as any).preloadAllAssets &&
        (this as any).preloadAllAssets().catch(() => {});
    } catch (e) {}
    return true;
  }

  // Preload SVG assets listed in AssetsConfig.svgAssets, extract mountpoints
  // and normalize them into radius-unit coordinates compatible with shapes2d
  async preloadAllAssets(): Promise<void> {
    try {
      const svgAssets = (AssetsConfig as any).svgAssets || {};
      // Compute team colors up-front so we can do a deterministic placeholder
      // pre-warm for headless/test environments before any async rasterization.
      const teams =
        TeamsConfig && (TeamsConfig as any).teams
          ? (TeamsConfig as any).teams
          : {};
      const teamColors: string[] = [];
      for (const tName of Object.keys(teams)) {
        const t = teams[tName];
        if (t && t.color) teamColors.push(t.color);
      }
      if (teamColors.length === 0) {
        const p = (AssetsConfig as any).palette || {};
        if (p.shipHull) teamColors.push(p.shipHull);
        if (p.shipAccent) teamColors.push(p.shipAccent);
      }
      // Ensure a placeholder tinted canvas exists for each declared shipType/teamColor
      try {
        if (!this._tintedHullPool)
          this._tintedHullPool = new TintedHullPool({
            globalCap: 256,
            perTeamCap: 64,
          });
        for (const shipType of Object.keys(svgAssets)) {
          try {
            for (const col of teamColors) {
              const k = `${shipType}::${col}`;
              if (!this._tintedHullPool.has(k)) {
                const pc = document.createElement("canvas");
                pc.width = 16;
                pc.height = 16;
                try {
                  this._setTintedCanvas(k, pc);
                } catch (e) {
                  if (this._tintedHullPool) this._tintedHullPool.set(k, pc);
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
      // In headless/test environments, rasterization can be async. Create
      // immediate placeholder canvases for declared svg assets so tests
      // that inspect _svgHullCache see entries synchronously.
      try {
        this._svgHullCache = this._svgHullCache || {};
        for (const k of Object.keys(svgAssets)) {
          if (
            !this._svgHullCache[k] &&
            typeof (svgAssets as any)[k] === "string"
          ) {
            const ph = document.createElement("canvas");
            ph.width = 128;
            ph.height = 128;
            const pctx = ph.getContext("2d");
            if (pctx) {
              pctx.fillStyle = "#fff";
              pctx.fillRect(0, 0, ph.width, ph.height);
            }
            this._svgHullCache[k] = ph;
          }
        }
      } catch (e) {}
      this._svgMountCache = this._svgMountCache || {};
      for (const key of Object.keys(svgAssets)) {
        try {
          const rel = (svgAssets as any)[key];
          let svgText = "";
          // If svgAssets contains an inlined SVG string (standalone build
          // injection), use it directly. Otherwise try fetch(rel) as a URL.
          try {
            if (typeof rel === "string" && rel.trim().startsWith("<svg")) {
              svgText = rel;
            } else {
              if (typeof fetch === "function") {
                const resp = await fetch(rel as string);
                if (resp && resp.ok) {
                  svgText = await resp.text();
                }
              }
            }
          } catch (e) {
            svgText = "";
          }
          // If fetch failed or not available, skip Node-specific disk read in browser build
          if (!svgText) continue;
          const parsed = svgLoader.parseSvgForMounts(svgText);
          const mounts = parsed.mounts || [];
          const engineMounts = parsed.engineMounts || [];
          const vb = parsed.viewBox || { w: 128, h: 128 };
          // Compute shape extent from shapes2d config so that normalized coords
          // map to the same scale used by shapes2d points. Fallback to 1.
          const shapeEntry: any =
            AssetsConfig.shapes2d && (AssetsConfig as any).shapes2d[key];
          let extent = 1;
          if (shapeEntry) {
            let maxv = 0;
            if (
              shapeEntry.type === "compound" &&
              Array.isArray(shapeEntry.parts)
            ) {
              for (const p of shapeEntry.parts) {
                if (p.type === "circle")
                  maxv = Math.max(maxv, Math.abs(p.r || 0));
                else if (p.type === "polygon")
                  for (const pt of p.points || []) {
                    maxv = Math.max(
                      maxv,
                      Math.abs(pt[0] || 0),
                      Math.abs(pt[1] || 0),
                    );
                  }
              }
            } else if (shapeEntry.type === "polygon") {
              for (const pt of shapeEntry.points || []) {
                maxv = Math.max(
                  maxv,
                  Math.abs(pt[0] || 0),
                  Math.abs(pt[1] || 0),
                );
              }
            } else if (shapeEntry.type === "circle")
              maxv = Math.max(maxv, Math.abs(shapeEntry.r || 0));
            extent = maxv || 1;
          }
          // Normalize turret mountpoints: convert from SVG viewBox coords to shape units
          const norm: [number, number][] = mounts.map((m: any) => {
            const nx = ((m.x || 0) - vb.w / 2) / (vb.w / 2 || 1);
            const ny = ((m.y || 0) - vb.h / 2) / (vb.h / 2 || 1);
            return [nx * extent, ny * extent];
          });
          this._svgMountCache[key] = norm;
          // Normalize engine mountpoints
          const engineNorm: [number, number][] = engineMounts.map((m: any) => {
            const nx = ((m.x || 0) - vb.w / 2) / (vb.w / 2 || 1);
            const ny = ((m.y || 0) - vb.h / 2) / (vb.h / 2 || 1);
            return [nx * extent, ny * extent];
          });
          this._svgEngineMountCache = this._svgEngineMountCache || {};
          this._svgEngineMountCache[key] = engineNorm;
          // Attempt to asynchronously rasterize and cache a hull-only canvas
          // using the higher-level svgRenderer. This ensures _svgHullCache
          // is populated with a resolved canvas (not a blank placeholder)
          // so sync reads later (getCachedHullCanvasSync) can draw immediately.
          try {
            const svgRenderer = require("./assets/svgRenderer");
            if (
              svgRenderer &&
              typeof svgRenderer.rasterizeSvgWithTeamColors === "function"
            ) {
              // Use the viewBox dimensions if available
              const outW = (vb && vb.w) || 128;
              const outH = (vb && vb.h) || 128;
              // Request rasterization with no mapping (hull-only baseline)
              (async () => {
                try {
                  const canvas = await svgRenderer.rasterizeSvgWithTeamColors(
                    svgText,
                    {},
                    outW,
                    outH,
                    { applyTo: "both", assetKey: key },
                  );
                  try {
                    this._svgHullCache = this._svgHullCache || {};
                    this._svgHullCache[key] = canvas;
                  } catch (e) {}
                } catch (e) {
                  // ignore async raster errors — fallback placeholders remain
                }
              })();
            }
          } catch (e) {}
          // Try to rasterize hull-only SVG proactively for faster first-draw
          try {
            const outW = vb.w || 128;
            const outH = vb.h || 128;
            // Kick off background rasterization only when no placeholder exists
            try {
              if (!this._svgHullCache || !this._svgHullCache[key]) {
                const outW = vb.w || 128;
                const outH = vb.h || 128;
                (async () => {
                  try {
                    let hullCanvas: HTMLCanvasElement | undefined = undefined;
                    try {
                      if (
                        typeof (svgLoader as any)
                          .rasterizeHullOnlySvgToCanvasAsync === "function"
                      ) {
                        hullCanvas = await (
                          svgLoader as any
                        ).rasterizeHullOnlySvgToCanvasAsync(
                          svgText,
                          outW,
                          outH,
                        );
                      } else {
                        hullCanvas = svgLoader.rasterizeHullOnlySvgToCanvas(
                          svgText,
                          outW,
                          outH,
                        ) as HTMLCanvasElement;
                      }
                    } catch (e) {
                      hullCanvas = undefined;
                    }
                    if (hullCanvas) {
                      try {
                        this._svgHullCache = this._svgHullCache || {};
                        this._svgHullCache[key] = hullCanvas;
                      } catch (e) {}
                      try {
                        const svgRenderer = require("./assets/svgRenderer");
                        if (
                          svgRenderer &&
                          typeof svgRenderer.cacheCanvasForAsset === "function"
                        ) {
                          svgRenderer.cacheCanvasForAsset(
                            key,
                            {},
                            hullCanvas.width,
                            hullCanvas.height,
                            hullCanvas,
                          );
                        }
                      } catch (e) {}
                    }
                  } catch (e) {}
                })();
              }
            } catch (e) {}
          } catch (e) {
            // ignore rasterization errors here; will fallback to lazy raster later
          }
          // Optionally, populate AssetsConfig.svgEngineMounts for backward compatibility
          try {
            (AssetsConfig as any).svgEngineMounts =
              (AssetsConfig as any).svgEngineMounts || {};
            (AssetsConfig as any).svgEngineMounts[key] = engineNorm;
          } catch (e) {}
        } catch (e) {
          // ignore per-asset errors
          // console.warn('Failed to preload SVG for', key, e);
        }
      }
      // Pre-warm tinted hull cache for known teams/types
      try {
        if (!this._tintedHullPool)
          this._tintedHullPool = new TintedHullPool({
            globalCap: 256,
            perTeamCap: 64,
          });
        const teams =
          TeamsConfig && (TeamsConfig as any).teams
            ? (TeamsConfig as any).teams
            : {};
        const teamColors: string[] = [];
        for (const tName of Object.keys(teams)) {
          const t = teams[tName];
          if (t && t.color) teamColors.push(t.color);
        }
        // Fallback to palette shipHull and shipAccent if no teams defined
        if (teamColors.length === 0) {
          const p = (AssetsConfig as any).palette || {};
          if (p.shipHull) teamColors.push(p.shipHull);
          if (p.shipAccent) teamColors.push(p.shipAccent);
        }
        const declaredSvgAssets = (AssetsConfig as any).svgAssets || {};
        for (const shipType of Object.keys(declaredSvgAssets)) {
          try {
            let hullCanvas = (this._svgHullCache as any)[shipType] as
              | HTMLCanvasElement
              | undefined;
            if (!hullCanvas) {
              try {
                const rel = (declaredSvgAssets as any)[shipType];
                if (typeof rel === "string" && rel.trim().startsWith("<svg")) {
                  const vbMatch =
                    /viewBox\s*=\s*"(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)"/.exec(
                      rel,
                    );
                  let outW = 128,
                    outH = 128;
                  if (vbMatch) {
                    outW = parseInt(vbMatch[3]) || 128;
                    outH = parseInt(vbMatch[4]) || 128;
                  }
                  try {
                    if (
                      typeof (svgLoader as any)
                        .rasterizeHullOnlySvgToCanvasAsync === "function"
                    ) {
                      try {
                        hullCanvas = await (
                          svgLoader as any
                        ).rasterizeHullOnlySvgToCanvasAsync(rel, outW, outH);
                      } catch (e) {
                        hullCanvas = undefined;
                      }
                    } else {
                      hullCanvas = svgLoader.rasterizeHullOnlySvgToCanvas(
                        rel,
                        outW,
                        outH,
                      );
                    }
                  } catch (e) {
                    hullCanvas = undefined;
                  }
                  if (!hullCanvas) {
                    const ph = document.createElement("canvas");
                    ph.width = outW;
                    ph.height = outH;
                    const pctx = ph.getContext("2d");
                    if (pctx) {
                      pctx.fillStyle = "#fff";
                      pctx.fillRect(0, 0, outW, outH);
                    }
                    hullCanvas = ph;
                  }
                  this._svgHullCache = this._svgHullCache || {};
                  this._svgHullCache[shipType] = hullCanvas;
                }
              } catch (e) {}
            }
            if (!hullCanvas) continue;
            for (const col of teamColors) {
              const k = `${shipType}::${col}`;
              if (this._tintedHullPool && this._tintedHullPool.has(k)) continue;
              try {
                const tc = document.createElement("canvas");
                tc.width = hullCanvas.width;
                tc.height = hullCanvas.height;
                const tctx = tc.getContext("2d");
                if (tctx) {
                  tctx.clearRect(0, 0, tc.width, tc.height);
                  tctx.drawImage(hullCanvas, 0, 0);
                  tctx.globalCompositeOperation = "source-atop";
                  tctx.fillStyle = col;
                  tctx.fillRect(0, 0, tc.width, tc.height);
                  tctx.globalCompositeOperation = "source-over";
                  this._setTintedCanvas(k, tc);
                  try {
                    const svgRenderer = require("./assets/svgRenderer");
                    if (
                      svgRenderer &&
                      typeof svgRenderer.cacheCanvasForAsset === "function"
                    ) {
                      svgRenderer.cacheCanvasForAsset(
                        shipType,
                        teamMapping(col),
                        tc.width,
                        tc.height,
                        tc,
                      );
                    }
                  } catch (e) {}
                }
              } catch (e) {
                /* ignore pre-warm errors */
              }
            }
          } catch (e) {
            /* ignore per-type pre-warm errors */
          }
        }
        // Ensure any declared assets that still lack hull canvases get a placeholder
        try {
          const declaredSvgAssets2 = (AssetsConfig as any).svgAssets || {};
          for (const shipType of Object.keys(declaredSvgAssets2)) {
            if (!this._svgHullCache || !this._svgHullCache[shipType]) {
              const ph = document.createElement("canvas");
              ph.width = 128;
              ph.height = 128;
              const pctx = ph.getContext("2d");
              if (pctx) {
                pctx.fillStyle = "#fff";
                pctx.fillRect(0, 0, ph.width, ph.height);
              }
              this._svgHullCache = this._svgHullCache || {};
              this._svgHullCache[shipType] = ph;
              for (const col of teamColors) {
                const k = `${shipType}::${col}`;
                if (this._tintedHullPool && this._tintedHullPool.has(k))
                  continue;
                try {
                  const tc = document.createElement("canvas");
                  tc.width = ph.width;
                  tc.height = ph.height;
                  const tctx = tc.getContext("2d");
                  if (tctx) {
                    tctx.clearRect(0, 0, tc.width, tc.height);
                    try {
                      tctx.drawImage(ph, 0, 0);
                    } catch (e) {}
                    try {
                      tctx.globalCompositeOperation = "source-atop";
                      tctx.fillStyle = col;
                      tctx.fillRect(0, 0, tc.width, tc.height);
                      tctx.globalCompositeOperation = "source-over";
                    } catch (e) {}
                  }
                  this._setTintedCanvas(k, tc);
                  try {
                    const svgRenderer = require("./assets/svgRenderer");
                    if (
                      svgRenderer &&
                      typeof svgRenderer.cacheCanvasForAsset === "function"
                    ) {
                      svgRenderer.cacheCanvasForAsset(
                        shipType,
                        teamMapping(col),
                        tc.width,
                        tc.height,
                        tc,
                      );
                    }
                  } catch (e) {}
                } catch (e) {
                  /* ignore per-key placeholder errors */
                }
              }
            }
          }
        } catch (e) {}
      } catch (e) {
        /* ignore pre-warm errors */
      }
      // Rasterize turret sprites for kinds listed in turretDefaults (or default 'basic')
      try {
        this._turretSpriteCache = this._turretSpriteCache || {};
        const turretDefs = (AssetsConfig as any).turretDefaults || {
          basic: { sprite: "turretBasic" },
        };
        const kinds = Object.keys(turretDefs);
        for (const k of kinds) {
          try {
            const spriteKey = (turretDefs as any)[k].sprite || "turretBasic";
            const tshape: any =
              (AssetsConfig as any).shapes2d &&
              (AssetsConfig as any).shapes2d[spriteKey];
            if (!tshape) continue;
            // Create offscreen canvas sized using renderer renderScale and a modest base
            const basePx = Math.max(
              24,
              Math.round(24 * (RendererConfig as any).renderScale || 1),
            );
            const canvas = document.createElement("canvas");
            const size = Math.max(16, basePx * 2);
            canvas.width = size;
            canvas.height = size;
            const ctx2 = canvas.getContext("2d");
            if (!ctx2) continue;
            ctx2.clearRect(0, 0, canvas.width, canvas.height);
            ctx2.translate(size / 2, size / 2);
            ctx2.fillStyle = (AssetsConfig as any).palette?.turret || "#94a3b8";
            // Determine a scale factor to map shape unit coords into pixel space
            const scale = size / 2 / 2; // heuristic: shape unit ~2 units radius
            if (tshape.type === "circle") {
              ctx2.beginPath();
              ctx2.arc(0, 0, (tshape.r || 1) * scale, 0, Math.PI * 2);
              ctx2.fill();
            } else if (tshape.type === "polygon") {
              ctx2.beginPath();
              const pts = tshape.points || [];
              if (pts.length) {
                ctx2.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
                for (let i = 1; i < pts.length; i++)
                  ctx2.lineTo(
                    (pts[i][0] || 0) * scale,
                    (pts[i][1] || 0) * scale,
                  );
                ctx2.closePath();
                ctx2.fill();
              }
            } else if (tshape.type === "compound") {
              for (const part of tshape.parts || []) {
                if (part.type === "circle") {
                  ctx2.beginPath();
                  ctx2.arc(0, 0, (part.r || 1) * scale, 0, Math.PI * 2);
                  ctx2.fill();
                } else if (part.type === "polygon") {
                  ctx2.beginPath();
                  const pts = part.points || [];
                  if (pts.length) {
                    ctx2.moveTo(
                      (pts[0][0] || 0) * scale,
                      (pts[0][1] || 0) * scale,
                    );
                    for (let i = 1; i < pts.length; i++)
                      ctx2.lineTo(
                        (pts[i][0] || 0) * scale,
                        (pts[i][1] || 0) * scale,
                      );
                    ctx2.closePath();
                    ctx2.fill();
                  }
                }
              }
            }
            this._turretSpriteCache[k] = canvas;
          } catch (e) {
            /* ignore turret raster errors */
          }
        }
      } catch (e) {}
    } catch (e) {
      // ignore global errors
    }
  }

  isRunning(): boolean {
    return false;
  }

  renderState(state: GameState, interpolation = 0): void {
    // helper: draw a stroked ring (used for explosions / flashes)
    function drawRing(
      x: number,
      y: number,
      R: number,
      color: string,
      alpha = 1.0,
      thickness = 2,
    ) {
      try {
        withContext(() => {
          activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
          activeBufferCtx.strokeStyle = color;
          activeBufferCtx.lineWidth = thickness * renderScale;
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(
            x * renderScale,
            y * renderScale,
            Math.max(1, R * renderScale),
            0,
            Math.PI * 2,
          );
          activeBufferCtx.stroke();
        });
      } catch (e) {
        /* ignore draw errors */
      }
    }
    // --- Offscreen buffer rendering ---
    // 1. Resize bufferCanvas to logical size × renderer scale BEFORE any drawing
    // 2. Draw all simulation visuals to bufferCanvas
    // 3. Copy bufferCanvas to main canvas ONLY after all drawing is finished
    const ctx = this.ctx!;
    const bufferCtx = this.bufferCtx!;
    if (!ctx || !bufferCtx) return;
    // Prefer canonical logical bounds from simConfig so renderer matches simulation
    // defaults. If unavailable, fall back to previous hard-coded values.
    const defaultBounds =
      typeof getDefaultBounds === "function"
        ? getDefaultBounds()
        : { W: 1920, H: 1080 };
    const LOGICAL_W =
      defaultBounds && typeof defaultBounds.W === "number"
        ? defaultBounds.W
        : 1920;
    const LOGICAL_H =
      defaultBounds && typeof defaultBounds.H === "number"
        ? defaultBounds.H
        : 1080;
    const renderScale =
      RendererConfig && typeof (RendererConfig as any).renderScale === "number"
        ? (RendererConfig as any).renderScale
        : 1;
    const fitScale = (RendererConfig as any)._fitScale || 1;
    // Resize bufferCanvas if needed (before any drawing)
    const bufferW = Math.round(LOGICAL_W * renderScale);
    const bufferH = Math.round(LOGICAL_H * renderScale);
    if (
      this.bufferCanvas.width !== bufferW ||
      this.bufferCanvas.height !== bufferH
    ) {
      this.bufferCanvas.width = bufferW;
      this.bufferCanvas.height = bufferH;
      // After resizing, need to re-acquire bufferCtx
      this.bufferCtx = this.bufferCanvas.getContext("2d");
      if (!this.bufferCtx) return;
    }
    // Always use latest bufferCtx after possible resize
    const activeBufferCtx = this.bufferCtx!;
    // Draw simulation to bufferCanvas
    activeBufferCtx.setTransform(1, 0, 0, 1, 0, 0); // No scaling here; scale coordinates instead
    activeBufferCtx.clearRect(0, 0, bufferW, bufferH);
    withContext(() => {
      activeBufferCtx.fillStyle =
        (AssetsConfig as any).palette?.background || "#0b1220";
      activeBufferCtx.fillRect(0, 0, bufferW, bufferH);
    });

    // helper: draw a polygon path from points (already scaled/rotated by transform)
    function drawPolygon(points: number[][]) {
      if (!points || points.length === 0) return;
      activeBufferCtx.beginPath();
      activeBufferCtx.moveTo(
        points[0][0] * renderScale,
        points[0][1] * renderScale,
      );
      for (let i = 1; i < points.length; i++)
        activeBufferCtx.lineTo(
          points[i][0] * renderScale,
          points[i][1] * renderScale,
        );
      activeBufferCtx.closePath();
      activeBufferCtx.fill();
    }

    // background starCanvas if present
    if (state && state.starCanvas) {
      if (state.starCanvas) {
        withContext(() => {
          activeBufferCtx.globalAlpha = 0.5;
          activeBufferCtx.drawImage(
            state.starCanvas as CanvasImageSource,
            0,
            0,
            bufferW,
            bufferH,
          );
        });
      }
    }

    // helper: current time for animation pulses
    const now = (state && state.t) || 0;

    // Spawn damage particles from recent damage events (renderer-owned particle bursts)
    try {
      const dmgAnim =
        AssetsConfig.animations && AssetsConfig.animations.damageParticles;
      if (Array.isArray(state.damageEvents) && dmgAnim) {
        state.particles = state.particles || [];
        for (const ev of state.damageEvents) {
          const count = dmgAnim.count || 6;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (dmgAnim.spread || 0.6);
            state.particles.push({
              x: ev.x || 0,
              y: ev.y || 0,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 0.6 + Math.random() * 0.8,
              color:
                dmgAnim.color ||
                (AssetsConfig as any).palette?.shipAccent ||
                "#ff6b6b",
              lifetime: dmgAnim.lifetime || 0.8,
              age: 0,
              shape: "circle",
            });
          }
        }
        // clear damageEvents after spawning so they are one-shot
        state.damageEvents = [];
      }
    } catch (e) {
      /* ignore particle spawn errors */
    }

    // Engine trail rendering (config-driven, per ship)
    // Helper to perform ship-local drawing with guaranteed save/restore.
    function withShipContext(s: any, fn: () => void) {
      activeBufferCtx.save();
      try {
        activeBufferCtx.translate(
          (s.x || 0) * renderScale,
          (s.y || 0) * renderScale,
        );
        activeBufferCtx.rotate(s.angle || 0);
        fn();
      } finally {
        try {
          activeBufferCtx.restore();
        } catch (e) {
          /* ignore restore errors */
        }
      }
    }

    // Generic helper to run a callback with save/restore around it.
    function withContext(fn: () => void) {
      activeBufferCtx.save();
      try {
        fn();
      } finally {
        try {
          activeBufferCtx.restore();
        } catch (e) {
          /* ignore */
        }
      }
    }

    for (const s of state.ships || []) {
      const sx = (s.x || 0) * renderScale;
      const sy = (s.y || 0) * renderScale;
      if (sx < 0 || sx >= bufferW || sy < 0 || sy >= bufferH) continue;
      // Update trail history (store in s.trail)
      if (state.engineTrailsEnabled) {
        s.trail = s.trail || [];
        // Only add new trail point if ship moved
        const last = s.trail.length ? s.trail[s.trail.length - 1] : null;
        if (!last || last.x !== s.x || last.y !== s.y) {
          s.trail.push({ x: s.x, y: s.y });
        }
        // Limit trail length using config
        const trailConfig = getEngineTrailConfig(
          s.type || getDefaultShipTypeSafe(),
        );
        const maxTrail = trailConfig?.maxLength || 40;
        while (s.trail.length > maxTrail) s.trail.shift();
      }

      // Draw engine trail (configurable shape, color, width, fade)
      if (Array.isArray(s.trail)) {
        const trailConfig = getEngineTrailConfig(
          s.type || getDefaultShipTypeSafe(),
        );
        const color =
          trailConfig?.color ||
          (AssetsConfig as any).palette?.bullet ||
          "#aee1ff";
        const width =
          (trailConfig?.width || 0.35) * (s.radius || 12) * renderScale;
        const fade = trailConfig?.fade || 0.35;
        // Use SVG engine mountpoints if available
        const engineMounts =
          this._svgEngineMountCache &&
          this._svgEngineMountCache[s.type || getDefaultShipTypeSafe()];
        if (Array.isArray(engineMounts) && engineMounts.length > 0) {
          for (const [emx, emy] of engineMounts) {
            for (let i = 0; i < s.trail.length; i++) {
              // Place trail at engine mount offset, rotated by ship angle
              const angle = s.angle || 0;
              const tx =
                s.x +
                (Math.cos(angle) * emx - Math.sin(angle) * emy) *
                  (s.radius || 12);
              const ty =
                s.y +
                (Math.sin(angle) * emx + Math.cos(angle) * emy) *
                  (s.radius || 12);
              // Fade alpha from fade to 1.0
              const tAlpha = fade + (1 - fade) * (i / s.trail.length);
              const txx = tx * renderScale;
              const tyy = ty * renderScale;
              if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH)
                continue;
              withContext(() => {
                activeBufferCtx.globalAlpha = tAlpha;
                activeBufferCtx.fillStyle = color;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(txx, tyy, width, 0, Math.PI * 2);
                activeBufferCtx.fill();
              });
            }
          }
        } else {
          // Fallback: single trail at ship center
          for (let i = 0; i < s.trail.length; i++) {
            const tx = s.trail[i].x || 0;
            const ty = s.trail[i].y || 0;
            // Fade alpha from fade to 1.0
            const tAlpha = fade + (1 - fade) * (i / s.trail.length);
            const txx = tx * renderScale;
            const tyy = ty * renderScale;
            if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH)
              continue;
            withContext(() => {
              activeBufferCtx.globalAlpha = tAlpha;
              activeBufferCtx.fillStyle = color;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(txx, tyy, width, 0, Math.PI * 2);
              activeBufferCtx.fill();
            });
          }
        }
      }

      // Draw ship hull using asset-agnostic sprite provider inside a ship-local
      // context so shapes can be drawn around (0,0).
  const sprite = getSpriteAsset(s.type || getDefaultShipTypeSafe());
      withShipContext(s, () => {
        // Resolve team color via TeamsConfig if available; fall back to palette
        let teamColor = (AssetsConfig as any).palette?.shipHull || "#888";
        try {
          if (s && s.team && TeamsConfig && (TeamsConfig as any).teams) {
            const teamEntry = (TeamsConfig as any).teams[s.team];
            if (teamEntry && teamEntry.color) teamColor = teamEntry.color;
          }
        } catch {}
        activeBufferCtx.fillStyle = teamColor;
        // --- SVG hull rendering ---
        let hullDrawn = false;
        if (sprite.svg) {
          // Cache rasterized hull-only SVG per ship type
          this._svgHullCache = this._svgHullCache || {};
          const cacheKey = s.type || getDefaultShipTypeSafe();
          let hullCanvas = this._svgHullCache[cacheKey];
          if (!hullCanvas) {
            try {
              // Use svgLoader to rasterize hull-only SVG
              const svgText = sprite.svg;
              // Use a reasonable size for rasterization (match viewBox or default)
              let outW = 128,
                outH = 128;
              const vbMatch =
                /viewBox\s*=\s*"(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)"/.exec(
                  svgText,
                );
              if (vbMatch) {
                outW = parseInt(vbMatch[3]) || 128;
                outH = parseInt(vbMatch[4]) || 128;
              }
              // Prefer a synchronously-available cached canvas from svgRenderer
              hullCanvas = (svgLoader as any).getCachedHullCanvasSync
                ? (svgLoader as any).getCachedHullCanvasSync(
                    svgText,
                    outW,
                    outH,
                    cacheKey,
                  )
                : undefined;
              if (!hullCanvas) {
                // If no sync cached canvas, try local synchronous rasterization as a fallback
                try {
                  hullCanvas = svgLoader.rasterizeHullOnlySvgToCanvas(
                    svgText,
                    outW,
                    outH,
                  ) as HTMLCanvasElement;
                } catch (e) {
                  hullCanvas = undefined;
                }
              }
              this._svgHullCache[cacheKey] = hullCanvas;
            } catch (e) {
              hullCanvas = undefined;
            }
          }
          if (hullCanvas) {
            // Center and scale hullCanvas to ship radius
            const scale =
              ((s.radius || 12) * renderScale) / (hullCanvas.width / 2);
            // Prepare tinted cache (per-team pool)
            if (!this._tintedHullPool)
              this._tintedHullPool = new TintedHullPool({
                globalCap: 256,
                perTeamCap: 64,
              });
            const tintedKey = `${cacheKey}::${teamColor}`;
            // Try to read and promote existing entry to MRU via pool
            let tintedCanvas: HTMLCanvasElement | undefined = undefined;
            if (this._tintedHullPool.has(tintedKey)) {
              const existing = this._tintedHullPool.get(tintedKey) as
                | HTMLCanvasElement
                | undefined;
              if (existing) {
                // If the existing cached canvas matches the desired size,
                // promote to MRU and use it. If it doesn't match (e.g. a
                // small placeholder pre-warmed during init), remove it so
                // we can generate or fetch a correctly-sized tinted canvas.
                try {
                  if (
                    existing.width === hullCanvas.width &&
                    existing.height === hullCanvas.height
                  ) {
                    // Promote to MRU by re-setting the entry
                    this._tintedHullPool.delete(tintedKey);
                    this._tintedHullPool.set(tintedKey, existing);
                    tintedCanvas = existing;
                  } else {
                    // size mismatch -> remove placeholder so we can create real one
                    try {
                      this._tintedHullPool.delete(tintedKey);
                    } catch (ee) {}
                  }
                } catch (e) {
                  // On any errors, fall back to treating as missing
                  try {
                    this._tintedHullPool.delete(tintedKey);
                  } catch (ee) {}
                }
              }
            }
            if (!tintedCanvas) {
              try {
                // lazy require to avoid circular imports at module load time
                const svgRenderer = require("./assets/svgRenderer");
                if (
                  svgRenderer &&
                  typeof svgRenderer.getCanvas === "function"
                ) {
                  const assetKey = cacheKey; // reuse cacheKey (shipType)
                  const mapping = teamMapping(teamColor);
                  // Prefer synchronous cached canvas if available
                  try {
                    const c = svgRenderer.getCanvas(
                      assetKey,
                      mapping,
                      hullCanvas.width,
                      hullCanvas.height,
                    );
                    if (c) {
                      tintedCanvas = c;
                      this._setTintedCanvas(tintedKey, c);
                    } else if (
                      typeof svgRenderer.rasterizeSvgWithTeamColors ===
                      "function"
                    ) {
                      // Trigger svgLoader.ensureRasterizedAndCached to populate cache async
                      try {
                        (svgLoader as any).ensureRasterizedAndCached &&
                          (svgLoader as any).ensureRasterizedAndCached(
                            sprite.svg,
                            mapping,
                            hullCanvas.width,
                            hullCanvas.height,
                            { assetKey, applyTo: "both" },
                          );
                      } catch (e) {}
                    }
                  } catch (e) {
                    /* ignore cache lookup errors */
                  }
                }
              } catch (e) {}

              // If the raster cache did not provide a synchronous canvas, create
              // a local tinted copy so we can draw this frame while the async
              // cached raster is produced for future frames.
              if (!tintedCanvas) {
                try {
                  const tc = document.createElement("canvas");
                  tc.width = hullCanvas.width;
                  tc.height = hullCanvas.height;
                  const tctx = tc.getContext("2d");
                  if (tctx) {
                    tctx.clearRect(0, 0, tc.width, tc.height);
                    tctx.drawImage(hullCanvas, 0, 0);
                    tctx.globalCompositeOperation = "source-in";
                    tctx.fillStyle = teamColor;
                    tctx.fillRect(0, 0, tc.width, tc.height);
                    tctx.globalCompositeOperation = "source-over";
                    tintedCanvas = tc;
                    this._setTintedCanvas(tintedKey, tc);
                  }
                } catch (e) {
                  /* ignore local tint errors */
                }
              }
            }

            // Draw the tinted (or original) canvas centered and scaled
            withContext(() => {
              activeBufferCtx.save();
              activeBufferCtx.scale(scale, scale);
              try {
                activeBufferCtx.drawImage(
                  tintedCanvas || hullCanvas,
                  -hullCanvas.width / 2,
                  -hullCanvas.height / 2,
                );
              } catch (e) {
                // fallback to drawing original if tinted draw fails
                try {
                  activeBufferCtx.drawImage(
                    hullCanvas,
                    -hullCanvas.width / 2,
                    -hullCanvas.height / 2,
                  );
                } catch (e) {}
              }
              activeBufferCtx.restore();
            });
            hullDrawn = true;
          }
        }
        // Fallback: draw shape if SVG hull not drawn
        if (!hullDrawn) {
          const shape = sprite.shape;
          if (shape) {
            if (shape.type === "circle") {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(
                0,
                0,
                (s.radius || 12) * renderScale,
                0,
                Math.PI * 2,
              );
              activeBufferCtx.fill();
            } else if (shape.type === "polygon") {
              drawPolygon(shape.points as number[][]);
            } else if (shape.type === "compound") {
              for (const part of shape.parts) {
                if (part.type === "circle") {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    0,
                    0,
                    (part.r || 1) * (s.radius || 12) * renderScale,
                    0,
                    Math.PI * 2,
                  );
                  activeBufferCtx.fill();
                } else if (part.type === "polygon") {
                  drawPolygon(part.points as number[][]);
                }
              }
            }
          }
        }
        // Draw engine flare if configured (local-space polygon offset behind/forward of ship)
        try {
          const vconf = getVisualConfig(s.type || getDefaultShipTypeSafe());
          const engineName =
            vconf && vconf.visuals && vconf.visuals.engine
              ? vconf.visuals.engine
              : "engineFlare";
          const engAnim =
            (AssetsConfig as any).animations &&
            (AssetsConfig as any).animations[engineName];
          if (engAnim && Array.isArray(engAnim.points)) {
            const radius = s.radius || 12;
            const offsetLocal =
              typeof engAnim.offset === "number"
                ? engAnim.offset * radius * renderScale
                : 0;
            withContext(() => {
              activeBufferCtx.translate(offsetLocal, 0);
              activeBufferCtx.globalAlpha =
                typeof engAnim.alpha === "number" ? engAnim.alpha : 1.0;
              activeBufferCtx.fillStyle =
                engAnim.color ||
                (AssetsConfig as any).palette?.shipAccent ||
                "#ffffff";
              activeBufferCtx.beginPath();
              const pts: number[][] = engAnim.points || [];
              if (pts.length) {
                activeBufferCtx.moveTo(
                  (pts[0][0] || 0) * radius * renderScale,
                  (pts[0][1] || 0) * radius * renderScale,
                );
                for (let pi = 1; pi < pts.length; pi++)
                  activeBufferCtx.lineTo(
                    (pts[pi][0] || 0) * radius * renderScale,
                    (pts[pi][1] || 0) * radius * renderScale,
                  );
                activeBufferCtx.closePath();
                activeBufferCtx.fill();
              }
            });
          }
        } catch (e) {
          /* ignore engine flare draw errors */
        }
        // Draw turrets. Turrets may have independent angles (turret.angle) and
        // turnRate. Mount positions can come from the ship instance, shapes2d
        // config, or extracted from SVGs (svgMounts). We prefer instance
        // positions, then shape config, then svgMounts as a last resort.
        const shipType = s.type || "fighter";
  const shipCfg = getShipConfigSafe()[shipType];
        const configRadius =
          shipCfg && typeof shipCfg.radius === "number"
            ? shipCfg.radius
            : s.radius || 12;
        const shapeEntry: any =
          AssetsConfig.shapes2d && (AssetsConfig.shapes2d as any)[shipType];
        const svgMounts =
          (AssetsConfig as any).svgMounts &&
          (AssetsConfig as any).svgMounts[shipType];
        const instanceTurrets = Array.isArray((s as any).turrets)
          ? (s as any).turrets
          : (shapeEntry && shapeEntry.turrets) || [];
        for (let ti = 0; ti < instanceTurrets.length; ti++) {
          try {
            const turret = instanceTurrets[ti];
            // If turret is a simple position tuple from svgMounts, normalize to object
            let turretObj: any = turret;
            if (!turretObj) continue;
            if (
              !turretObj.position &&
              Array.isArray(turret) &&
              turret.length === 2
            ) {
              turretObj = { kind: "basic", position: turret };
            }
            // As a last resort, try to use svgMounts mapping for this index
            if (
              (!turretObj.position || turretObj.position.length !== 2) &&
              Array.isArray(svgMounts) &&
              svgMounts[ti]
            ) {
              turretObj.position = svgMounts[ti];
            }
            if (!turretObj.position) continue;
            const turretKind = turretObj.kind || "basic";
            const turretShape = getTurretAsset(turretKind as any);
            // Turret angle: instance-provided turret.angle if present, else default to ship angle
            // turretObj.angle is stored as local turret rotation relative to ship
            const turretLocalAngle =
              typeof turretObj.angle === "number"
                ? turretObj.angle
                : typeof (s as any).turretAngle === "number"
                  ? (s as any).turretAngle
                  : 0;
            // Turret turnRate: instance value, else assets-config default, else fallback
            const turretTurnRate =
              typeof turretObj.turnRate === "number"
                ? turretObj.turnRate
                : ((AssetsConfig as any).turretDefaults &&
                    (AssetsConfig as any).turretDefaults[turretKind] &&
                    (AssetsConfig as any).turretDefaults[turretKind]
                      .turnRate) ||
                  Math.PI * 1.5;
            const [tx, ty] = turretObj.position; // mount local coords (radius units)
            // Convert mount local coords (radius units) into ship-local pixels and rotate by ship heading
            const angle = s.angle || 0;
            const turretX =
              (Math.cos(angle) * tx - Math.sin(angle) * ty) *
              configRadius *
              renderScale;
            const turretY =
              (Math.sin(angle) * tx + Math.cos(angle) * ty) *
              configRadius *
              renderScale;
            const turretScale = configRadius * renderScale * 0.5;
            withContext(() => {
              activeBufferCtx.translate(turretX, turretY);
              // Rotate turret independently by turretAngle (relative to world)
              activeBufferCtx.rotate(turretLocalAngle - (s.angle || 0));
              // Try to draw cached rasterized turret sprite for this kind
              const spriteCanvas =
                this._turretSpriteCache && this._turretSpriteCache[turretKind];
              if (spriteCanvas) {
                try {
                  const pw = spriteCanvas.width;
                  const ph = spriteCanvas.height;
                  activeBufferCtx.drawImage(
                    spriteCanvas,
                    -pw / 2,
                    -ph / 2,
                    pw,
                    ph,
                  );
                  return;
                } catch (e) {}
              }
              // Fallback vector draw
              activeBufferCtx.fillStyle =
                (AssetsConfig as any).palette?.turret || "#94a3b8";
              if (turretShape.type === "circle") {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (turretShape.r || 1) * turretScale,
                  0,
                  Math.PI * 2,
                );
                activeBufferCtx.fill();
              } else if (turretShape.type === "polygon") {
                withContext(() => {
                  activeBufferCtx.scale(turretScale, turretScale);
                  drawPolygon(turretShape.points as number[][]);
                });
              } else if (turretShape.type === "compound") {
                for (const part of turretShape.parts) {
                  if (part.type === "circle") {
                    activeBufferCtx.beginPath();
                    activeBufferCtx.arc(
                      0,
                      0,
                      (part.r || 1) * turretScale,
                      0,
                      Math.PI * 2,
                    );
                    activeBufferCtx.fill();
                  } else if (part.type === "polygon") {
                    withContext(() => {
                      activeBufferCtx.scale(turretScale, turretScale);
                      drawPolygon(part.points as number[][]);
                    });
                  }
                }
              }
            });
          } catch (e) {
            /* ignore turret draw errors per turret */
          }
        }

        // Draw shield effect (outline) in ship-local coords at 0,0
        if ((s.shield ?? 0) > 0) {
          const shAnim =
            (AssetsConfig as any).animations &&
            (AssetsConfig as any).animations.shieldEffect;
          try {
            // Compute alpha and stroke params from animation config if present
            const pulse =
              shAnim && typeof shAnim.pulseRate === "number"
                ? 0.5 + 0.5 * Math.sin(now * shAnim.pulseRate)
                : 1.0;
            const shieldNorm = Math.max(
              0,
              Math.min(1, (s.shield || 0) / (s.maxShield || s.shield || 1)),
            );
            const alphaBase =
              shAnim && typeof shAnim.alphaBase === "number"
                ? shAnim.alphaBase
                : (shAnim && shAnim.alpha) || 0.25;
            const alphaScale =
              shAnim && typeof shAnim.alphaScale === "number"
                ? shAnim.alphaScale
                : 0.75;
            const alpha = Math.max(
              0,
              Math.min(1, alphaBase + alphaScale * pulse * shieldNorm),
            );
            const strokeColor =
              (shAnim && shAnim.color) ||
              (AssetsConfig as any).palette?.shipAccent ||
              "#3ab6ff";
            const strokeWidth =
              (shAnim &&
                (shAnim.strokeWidth || 0.08) *
                  (s.radius || 12) *
                  renderScale) ||
              3 * renderScale;

            // Try to extract SVG hull outline for shield stroke
            let stroked = false;
            try {
              const { getHullOutlineFromSvg } = require("./assets/svgLoader");
              const svgText = getShipAsset(s.type);
              if (svgText) {
                const outline = getHullOutlineFromSvg(svgText, 1.5);
                if (outline && outline.contours && outline.contours.length) {
                  withContext(() => {
                    activeBufferCtx.globalAlpha = alpha;
                    activeBufferCtx.strokeStyle = strokeColor;
                    activeBufferCtx.lineWidth = strokeWidth;
                    for (const contour of outline.contours) {
                      if (contour.length) {
                        activeBufferCtx.beginPath();
                        activeBufferCtx.moveTo(
                          (contour[0][0] || 0) * (s.radius || 12) * renderScale,
                          (contour[0][1] || 0) * (s.radius || 12) * renderScale,
                        );
                        for (let i = 1; i < contour.length; i++)
                          activeBufferCtx.lineTo(
                            (contour[i][0] || 0) *
                              (s.radius || 12) *
                              renderScale,
                            (contour[i][1] || 0) *
                              (s.radius || 12) *
                              renderScale,
                          );
                        activeBufferCtx.closePath();
                        activeBufferCtx.stroke();
                      }
                    }
                  });
                  stroked = true;
                }
              }
            } catch (e) {
              /* ignore shield draw errors */
            }
            // Fallback: legacy circle stroke if no polygon
            if (!stroked) {
              withContext(() => {
                activeBufferCtx.globalAlpha = alpha;
                activeBufferCtx.strokeStyle = strokeColor;
                activeBufferCtx.lineWidth = strokeWidth;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (s.radius || 12) * renderScale,
                  0,
                  Math.PI * 2,
                );
                activeBufferCtx.stroke();
              });
            }
            // HP/shield bar rendering (restored baseline)
            const baseW = Math.max(20, (s.radius || 12) * 1.6);
            const baseH = Math.max(4, Math.round((s.radius || 12) * 0.25));
            const dx = -Math.round(baseW / 2);
            const dy = -(s.radius || 12) - baseH - 6;
            const hbBg = (AssetsConfig as any).palette?.background || "#222";
            const hbFill = (AssetsConfig as any).palette?.shipHull || "#4caf50";
            const hpPct =
              typeof (s as any).hpPercent === "number"
                ? (s as any).hpPercent
                : Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
            const shPct =
              typeof (s as any).shieldPercent === "number"
                ? (s as any).shieldPercent
                : typeof s.maxShield === "number" && s.maxShield > 0
                  ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield))
                  : 0;
            const w = Math.max(1, Math.round(baseW * renderScale));
            const h = Math.max(1, Math.round(baseH * renderScale));
            const ox = Math.round(dx * renderScale);
            const oy = Math.round(dy * renderScale);
            const sx = Math.round((s.x || 0) * renderScale);
            const sy = Math.round((s.y || 0) * renderScale);
            withContext(() => {
              // Background
              activeBufferCtx.fillStyle = hbBg;
              activeBufferCtx.fillRect(sx + ox, sy + oy, w, h);
              // HP fill (left-to-right)
              activeBufferCtx.fillStyle = hbFill;
              activeBufferCtx.fillRect(
                sx + ox,
                sy + oy,
                Math.max(1, Math.round(w * hpPct)),
                h,
              );
              // Shield overlay: thin bar above HP bar
              if (shPct > 0) {
                const shH = Math.max(1, Math.round(h * 0.5));
                activeBufferCtx.fillStyle =
                  (AssetsConfig as any).palette?.shipAccent || "#3ab6ff";
                activeBufferCtx.fillRect(
                  sx + ox,
                  sy + oy - shH - 2,
                  Math.max(1, Math.round(w * shPct)),
                  shH,
                );
              }
            });
          } catch (e) {
            /* ignore shield draw errors */
          }
        }
      }); // end withShipContext for this ship

      // Health hits: render freshest per-ship health flash using index (reddish rings), pooled
      try {
        const nowT = state.t || 0;
        for (const s of state.ships || []) {
          try {
            let flash: any = null;
            const arr = Array.isArray(state.healthFlashes)
              ? state.healthFlashes.filter((f: any) => f.id === s.id)
              : [];
            let bestTs = -Infinity;
            for (const f of arr) {
              if (!f) continue;
              const fTs = typeof f._ts === "number" ? f._ts : 0;
              const fTtl = typeof f.ttl === "number" ? f.ttl : 0.4;
              if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) {
                bestTs = fTs;
                flash = f;
              }
            }
            if (flash) {
              // Use pooled effect for health flash
              const pooledFlash = acquireEffect(
                state,
                "healthFlash",
                () =>
                  makePooled(
                    // Use typed factory to create base health effect and attach render fields via reset
                    createHealthHitEffect({
                      x: flash.x || s.x || 0,
                      y: flash.y || s.y || 0,
                    }),
                    (obj, initArgs) => {
                      // rehydrate base health fields
                      resetHealthHitEffect(obj, initArgs as any);
                      // attach/rehydrate render-specific fields
                      (obj as any).ttl = initArgs?.ttl ?? 0.4;
                      (obj as any).life = initArgs?.life ?? (obj as any).ttl;
                      (obj as any).color = "#ff7766";
                      (obj as any).radius = 6;
                    },
                  ),
                flash,
              );
              type RenderHealthFlash = HealthHitEffect & {
                ttl: number;
                life: number;
                color: string;
                radius: number;
              };
              const pf = pooledFlash as unknown as RenderHealthFlash;
              const t = Math.max(0, Math.min(1, pf.life / pf.ttl));
              const R = (pf.radius as number) + (1 - t) * 18;
              const alpha = 0.9 * t;
              const fx = (pf.x as number) * renderScale;
              const fy = (pf.y as number) * renderScale;
              if (fx >= 0 && fx < bufferW && fy >= 0 && fy < bufferH) {
                withContext(() => {
                  activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
                  activeBufferCtx.strokeStyle = pf.color;
                  activeBufferCtx.lineWidth = 2 * renderScale;
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    fx,
                    fy,
                    Math.max(1, R * renderScale),
                    0,
                    Math.PI * 2,
                  );
                  activeBufferCtx.stroke();
                });
              }
              releaseEffect(state, "healthFlash", pooledFlash);
            }
          } catch (e) {}
        }
      } catch (e) {}

      // bullets
      for (const b of state.bullets || []) {
        try {
          const bx = (b.x || 0) * renderScale;
          const by = (b.y || 0) * renderScale;
          if (bx < 0 || bx >= bufferW || by < 0 || by >= bufferH) continue;
          const r = b.radius || b.bulletRadius || 1.5;
          const kind =
            typeof b.bulletRadius === "number"
              ? b.bulletRadius < 2
                ? "small"
                : b.bulletRadius < 3
                  ? "medium"
                  : "large"
              : "small";
          const shape = getBulletAsset(kind as any);
          withContext(() => {
            activeBufferCtx.translate(bx, by);
            const px = Math.max(1, r * renderScale);
            activeBufferCtx.fillStyle = AssetsConfig.palette.bullet;
            if (shape.type === "circle") {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, px, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (shape.type === "polygon") {
              drawPolygon(shape.points as number[][]);
            } else if (shape.type === "compound") {
              for (const part of shape.parts) {
                if (part.type === "circle") {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(0, 0, (part.r || 1) * px, 0, Math.PI * 2);
                  activeBufferCtx.fill();
                } else if (part.type === "polygon") {
                  drawPolygon(part.points as number[][]);
                }
              }
            }
          });
        } catch (e) {}
      }
      // particles (pooled)
      try {
        const shapes = (AssetsConfig as any).shapes2d || {};
        for (const p of state.particles || []) {
          try {
            // Use pooled sprite for particle visuals
            const particle = acquireSprite(
              state,
              "particle",
              () =>
                makePooled(
                  {
                    x: p.x || 0,
                    y: p.y || 0,
                    r: p.r || 1,
                    color:
                      p.color ||
                      (AssetsConfig as any).palette?.bullet ||
                      "#ffdca8",
                    age: p.age || 0,
                    lifetime: p.lifetime || 1,
                    assetShape: p.assetShape,
                  },
                  (obj, initArgs) => {
                    obj.x = initArgs?.x ?? 0;
                    obj.y = initArgs?.y ?? 0;
                    obj.r = initArgs?.r ?? 1;
                    obj.color = initArgs?.color ?? "#ffdca8";
                    obj.age = initArgs?.age ?? 0;
                    obj.lifetime = initArgs?.lifetime ?? 1;
                    obj.assetShape = initArgs?.assetShape;
                  },
                ),
              p,
            );
            const px = particle.x * renderScale;
            const py = particle.y * renderScale;
            if (px < 0 || px >= bufferW || py < 0 || py >= bufferH) continue;
            withContext(() => {
              const shapeName =
                particle.assetShape ||
                (particle.r > 0.5 ? "particleMedium" : "particleSmall");
              const shape = shapes[shapeName];
              activeBufferCtx.fillStyle = particle.color;
              activeBufferCtx.globalAlpha = Math.max(
                0,
                Math.min(1, 1 - particle.age / particle.lifetime),
              );
              activeBufferCtx.translate(px, py);
              if (shape) {
                if (shape.type === "circle") {
                  const rr = (shape.r || 0.12) * particle.r * renderScale * 6;
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
                  activeBufferCtx.fill();
                } else if (shape.type === "polygon") {
                  activeBufferCtx.beginPath();
                  const pts = shape.points || [];
                  if (pts.length) {
                    activeBufferCtx.moveTo(
                      (pts[0][0] || 0) * renderScale,
                      (pts[0][1] || 0) * renderScale,
                    );
                    for (let i = 1; i < pts.length; i++)
                      activeBufferCtx.lineTo(
                        (pts[i][0] || 0) * renderScale,
                        (pts[i][1] || 0) * renderScale,
                      );
                    activeBufferCtx.closePath();
                    activeBufferCtx.fill();
                  }
                } else if (shape.type === "compound") {
                  for (const part of shape.parts || []) {
                    if (part.type === "circle") {
                      const rr =
                        (part.r || 0.12) * particle.r * renderScale * 6;
                      activeBufferCtx.beginPath();
                      activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
                      activeBufferCtx.fill();
                    } else if (part.type === "polygon") {
                      activeBufferCtx.beginPath();
                      const pts = part.points || [];
                      if (pts.length) {
                        activeBufferCtx.moveTo(
                          (pts[0][0] || 0) * renderScale,
                          (pts[0][1] || 0) * renderScale,
                        );
                        for (let i = 1; i < pts.length; i++)
                          activeBufferCtx.lineTo(
                            (pts[i][0] || 0) * renderScale,
                            (pts[i][1] || 0) * renderScale,
                          );
                        activeBufferCtx.closePath();
                        activeBufferCtx.fill();
                      }
                    }
                  }
                } else {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    0,
                    0,
                    (particle.r || 2) * renderScale,
                    0,
                    Math.PI * 2,
                  );
                  activeBufferCtx.fill();
                }
              } else {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (particle.r || 2) * renderScale,
                  0,
                  Math.PI * 2,
                );
                activeBufferCtx.fill();
              }
            });
            releaseSprite(state, "particle", particle);
          } catch (e) {}
        }
      } catch (e) {
        /* ignore particle render errors */
      }

      // Explosions (flashes) use explosionParticle if available, pooled via acquireEffect
      try {
        const expShape =
          (AssetsConfig as any).shapes2d &&
          (AssetsConfig as any).shapes2d.explosionParticle;
        for (const ex of state.explosions || []) {
          try {
            // Use pooled effect for explosion visuals
            const effect = acquireEffect(
              state,
              "explosion",
              () =>
                makePooled(
                  createExplosionEffect({
                    x: ex.x || 0,
                    y: ex.y || 0,
                    r: (expShape && expShape.r) || 0.32,
                  }),
                  (obj, initArgs) => {
                    // rehydrate base explosion fields
                    resetExplosionEffect(obj, initArgs as any);
                    // attach/rehydrate render-specific fields
                    (obj as any).scale = initArgs?.scale ?? 1;
                    (obj as any).color = initArgs?.color ?? "#ffd089";
                    (obj as any).alpha =
                      initArgs?.alpha ??
                      (1 - (ex.life || 0.5) / (ex.ttl || 0.5)) * 0.9;
                  },
                ),
              ex,
            );
            type RenderExplosion = ExplosionEffect & {
              scale?: number;
              color?: string;
              alpha?: number;
            };
            const ef = effect as unknown as RenderExplosion;
            withContext(() => {
              activeBufferCtx.globalAlpha = (ef.alpha as number) || 0;
              activeBufferCtx.translate(
                (ef.x as number) * renderScale,
                (ef.y as number) * renderScale,
              );
              activeBufferCtx.fillStyle =
                ef.color || (AssetsConfig as any).palette?.bullet || "#ffd089";
              if (expShape && expShape.type === "circle") {
                const rr = (ef.r || 0.32) * (ef.scale || 1) * renderScale * 6;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  rr * (1 + (1 - (ex.life || 0.5) / (ex.ttl || 0.5))),
                  0,
                  Math.PI * 2,
                );
                activeBufferCtx.fill();
              } else {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  Math.max(
                    2,
                    (ef.scale || 1) *
                      12 *
                      (1 - (ex.life || 0.5) / (ex.ttl || 0.5)),
                  ),
                  0,
                  Math.PI * 2,
                );
                activeBufferCtx.fill();
              }
            });
            releaseEffect(state, "explosion", effect);
          } catch (e) {}
        }
      } catch (e) {}

      // --- Copy bufferCanvas to main canvas, scaling to fit window ---
      // Only copy after all drawing is finished
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for drawImage
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.imageSmoothingEnabled = false;
      // Copy buffer to canvas at 1:1 scaling; let CSS handle visual scaling if needed
      ctx.drawImage(
        this.bufferCanvas,
        0,
        0,
        this.bufferCanvas.width,
        this.bufferCanvas.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      ctx.restore();
    }
  }
}

export default CanvasRenderer;
