import { createInitialState, resetState, spawnFleet, spawnShip } from './core/gameState.js';
// Import UI styles so webpack extracts them into a hashed CSS asset via MiniCssExtractPlugin
import './styles/ui.css';
// Ensure low-level GL/readPixels patches are applied as early as possible
// so prototype wrappers and GL instrumentation are present before any
// renderer instances are created by other modules.
import { applyGlobalPatches } from './renderer/effects.js';

try {
  applyGlobalPatches();
} catch (_e) {
  void _e; /* ignore */
}
import * as THREE from 'three';

// Expose canonical Three.js runtime to globalThis so modules using different
// bundling/resolution still reference the same constructors at runtime.
// This mitigates "Multiple instances of Three.js being imported" issues
// which can break attribute/constructor identity used by the renderer.
// Keep this as early as possible in the bootstrap sequence.

/* global globalThis */
if (!(globalThis as any).THREE) {
  (globalThis as any).THREE = THREE;
}
import type { GameState, UIElements } from './types/index.js';
import { createThreeRenderer } from './renderer/threeRenderer.js';
import { shipInstancer } from './renderer/shipInstancer.js';
import { RendererConfig } from './config/rendererConfig.js';
import { createPhysicsStepper } from './core/physics.js';
import { CameraConfig } from './config/cameraConfig.js';
import { FleetConfig } from './config/fleetConfig.js';
// DefaultSimConfig not used here; keep config imports minimal to avoid unused-import ESLint errors
import { getSVGLoader, loadSVGAsset } from './core/svgLoader.js';
import * as logger from './utils/logger.js';
import { DefaultGameConfig } from './config/gameConfig.js';
import { defaultSVGConfig, getShipSVGUrls } from './config/svgConfig.js';
import { perf } from './utils/perf.js';
import { bindUI } from './ui/bindUI.js';
import { randomClass } from './utils/randomShipClass.js';
import { reFormFleets } from './core/reFormFleets.js';
import { startLoops } from './core/startLoops.js';
import { setupPerfOverlay } from './utils/perfOverlay.js';
import { enablePerfCollectorIfRequested } from './utils/perfCollector.js';
import { wireControls } from './ui/wireControls.js';
import { setupCameraControls } from './renderer/cameraControls.js';

// Strongly-typed runtime debug hooks exposed on globalThis when enabled.
declare global {
  interface Window {
    __appDebug?: unknown;
    __shipInstancer?: typeof shipInstancer;
    DEBUG_SHIP_INSTANCER?: boolean;
  }
  interface GlobalEventHandlers {}
}

function initGame(seed?: string) {
  const ui = bindUI();
  const state = createInitialState(seed);
  // Ensure there is an asset pool for GLTFs and textures
  state.assetPool = new Map<string, unknown>();

  // Generate a lightweight soft-circle explosion sprite and store in asset pool.
  // We create a small canvas with radial gradient so we don't need an external asset.
  try {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
      // center bright, edges transparent
      grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
      grad.addColorStop(0.25, 'rgba(255,200,80,0.95)');
      grad.addColorStop(0.5, 'rgba(200,80,30,0.6)');
      grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Convert to ImageBitmap when supported for faster GPU upload
      (async () => {
        try {
          let bitmap: ImageBitmap | null = null;
          if ((window as any).createImageBitmap) {
            bitmap = await (window as any).createImageBitmap(canvas);
          }
          // Store both canvas and bitmap for callers that expect either
          state.assetPool!.set('textures/explosionSoftCircle', bitmap ?? canvas);
          logger.debug(
            '[main.ts] Generated explosion sprite and stored in assetPool as textures/explosionSoftCircle',
          );
        } catch (e) {
          void e;
          state.assetPool!.set('textures/explosionSoftCircle', canvas);
        }
      })();
    }
  } catch (ee) {
    void ee; /* ignore canvas generation failures in test envs */
  }

  const shipSVGUrls = getShipSVGUrls(defaultSVGConfig);
  const gltfModeEnabled = !!(RendererConfig as any)?.loadGltfModels;
  const svgDisabled = !!(RendererConfig as any)?.disableSvgSubsystem;

  // Preload SVG assets and construct the SVG loader only when GLTF model loading is disabled.
  // This avoids creating the raster worker and warming the asset pool when using GLTF prototypes.
  let svgLoader: ReturnType<typeof getSVGLoader> | undefined;
  if (!gltfModeEnabled && !svgDisabled) {
    svgLoader = getSVGLoader();
    (async () => {
      try {
        logger.debug('[main.ts] Preloading SVG assets with change detection...');

        for (const svgUrl of shipSVGUrls) {
          try {
            // Load SVG with rasterization
            const asset = await loadSVGAsset(svgUrl, {
              width: defaultSVGConfig.defaultRasterSize.width,
              height: defaultSVGConfig.defaultRasterSize.height,
              enableWatching: defaultSVGConfig.cache.enableFileWatching,
            });

            // Store in asset pool for renderer access
            state.assetPool!.set(svgUrl, asset);

            logger.debug(`[main.ts] Loaded SVG asset: ${svgUrl}`);
          } catch (_error) {
            void _error;
            logger.warn(`[main.ts] Failed to load SVG asset ${svgUrl}:`, _error);
          }
        }

        logger.debug('[main.ts] SVG asset preloading complete');
      } catch (_error) {
        void _error;
        logger.error('[main.ts] Error during SVG asset preloading:', _error);
      }
    })();
  } else {
    logger.debug('[main.ts] Skipping SVG preload because GLTF mode or SVG subsystem disabled');
  }
  (window as any).debugSVG = {
    // Get SVG loader stats (no-op when GLTF mode enabled)
    getStats: () => {
      if ((RendererConfig as any)?.loadGltfModels || svgDisabled) {
        logger.debug(
          '[SVG Debug] GLTF mode enabled or SVG subsystem disabled; SVG loader stats are disabled',
        );
        return { cachedAssets: 0 } as any;
      }
      if (!svgLoader) return { cachedAssets: 0 } as any;
      const stats = svgLoader.getCacheStats();
      logger.debug('[SVG Debug] Cache stats:', stats);
      return stats;
    },

    // Manually reload all SVG assets
    reloadAll: async () => {
      if ((RendererConfig as any)?.loadGltfModels || svgDisabled) {
        logger.debug('[SVG Debug] GLTF mode enabled; reloadAll is a no-op');
        return;
      }
      if (!svgLoader) return;
      logger.debug('[SVG Debug] Manually reloading all SVG assets...');
      try {
        await svgLoader.reloadAllAssets();
        logger.debug('[SVG Debug] All SVG assets reloaded successfully');
      } catch (_error) {
        void _error;
        logger.error('[SVG Debug] Failed to reload SVG assets:', _error);
      }
    },

    // Clear SVG cache
    clearCache: (assetUrl?: string) => {
      if ((RendererConfig as any)?.loadGltfModels || svgDisabled) {
        logger.debug(
          '[SVG Debug] GLTF mode enabled or SVG subsystem disabled; clearCache is a no-op',
        );
        return;
      }
      logger.debug(
        '[SVG Debug] Clearing SVG cache...',
        assetUrl ? `for ${assetUrl}` : 'all assets',
      );
      svgLoader?.clearCache(assetUrl);
      logger.debug('[SVG Debug] SVG cache cleared');
    },

    // List cached assets
    listCached: () => {
      if ((RendererConfig as any)?.loadGltfModels || svgDisabled) {
        logger.debug(
          '[SVG Debug] GLTF mode enabled or SVG subsystem disabled; no cached SVG assets',
        );
        return [];
      }
      if (!svgLoader) return [];
      const stats = svgLoader.getCacheStats();
      const assets = Array.from(stats && stats.cachedAssets > 0 ? 'assets cached' : []);
      logger.debug('[SVG Debug] Cached SVG assets:', assets);
      return assets;
    },
  };

  logger.debug('[main.ts] SVG debugging functions available at window.debugSVG');
  logger.debug(
    '[main.ts] Use debugSVG.getStats(), debugSVG.reloadAll(), debugSVG.clearCache(), debugSVG.listCached()',
  );

  // Expose lightweight debug helpers for quick console testing
  (window as any).__appDebug = {
    getState: () => state,
    listAssetPool: () => Array.from((state.assetPool ?? new Map()).keys()),
    getAsset: (k: string) => (state.assetPool as Map<string, unknown>)?.get(k),
    // lazy loader wrappers to avoid bundling load-only code paths unless used
    preloadSingleShip: async (cls: string, team = 'red') => {
      try {
        const mod = await import('./core/shipModelLoader.js');
        return (mod.preloadSingleShip as any)(state, cls, team);
      } catch (err) {
        console.warn('preloadSingleShip failed', err);
        return null;
      }
    },
    preloadShipModels: async () => {
      try {
        const mod = await import('./core/shipModelLoader.js');
        return (mod.preloadShipModels as any)(state, ['red', 'blue']);
      } catch (err) {
        console.warn('preloadShipModels failed', err);
        return null;
      }
    },
  } as any;

  // Try to run Rapier in a worker (simWorker). If that fails, fall back to in-thread physics stepper.
  (async () => {
    try {
      // Create a module worker for simWorker.ts (Webpack will emit a JS chunk)
      const useSimWorker = (RendererConfig as any)?.useSimWorker ?? true;
      let w: Worker | null = null;
      // If the config opts out of creating a sim worker, run the physics stepper in-thread immediately
      if (!useSimWorker) {
        console.debug(
          '[main.ts] Skipping simWorker creation (RendererConfig.useSimWorker=false); using in-thread physics',
        );
        try {
          const ps = await createPhysicsStepper(state as any);
          (state as any).physicsStepper = ps;
        } catch (ee) {
          void ee; /* ignore and continue */
        }
        return; // no worker setup required
      }

      // Create a module worker for simWorker.ts (Webpack will emit a JS chunk)
      w = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
      let ready = false;
      let lastShipDataVersion = -1;

      if (w) {
        w.addEventListener('message', (ev) => {
          const data = ev.data || {};
          const type = data.type;
          // Perf events from simWorker
          if (
            type === 'perf' &&
            (window as any).__perf &&
            typeof (window as any).__perf.addEvent === 'function'
          ) {
            try {
              (window as any).__perf.addEvent({ name: data.name, ms: data.ms });
            } catch {
              /* ignore */
            }
            return;
          }
          // init handshake
          if (type === 'init-physics-done') {
            ready = !!data.ok;
            return;
          }

          // step result: supports packed Float32Array buffer (transformsBuffer)
          if (type === 'step-physics-done') {
            // Prefer transferable typed-array buffer payload for low-overhead transfer
            const buf =
              data.transformsBuffer || (data.transforms && data.transforms.buffer) || null;
            if (buf) {
              try {
                const arr = new Float32Array(buf);
                // Each entry is [id, px, py, pz, vx, vy, vz]
                for (let i = 0; i < arr.length; i += 7) {
                  const id = Math.floor(arr[i]);
                  const ship = state.shipIndex?.get(id) ?? state.ships.find((s) => s.id === id);
                  if (!ship) continue;
                  ship.pos.x = arr[i + 1];
                  ship.pos.y = arr[i + 2];
                  ship.pos.z = arr[i + 3];
                  ship.vel.x = arr[i + 4];
                  ship.vel.y = arr[i + 5];
                  ship.vel.z = arr[i + 6];
                }
              } catch (_e) {
                void _e; // Fallback to older object-based transforms if parsing fails
                const transforms = data.transforms || [];
                // Optional payload size audit
                try {
                  if ((window as any).__perf)
                    (window as any).__perf.addEvent({
                      name: 'physics.payload.recvKB',
                      ms: JSON.stringify(transforms).length / 1000,
                    });
                } catch {}
                for (const transform of transforms) {
                  const ship =
                    state.shipIndex?.get(transform.shipId) ??
                    state.ships.find((s) => s.id === transform.shipId);
                  if (ship) {
                    ship.pos.x = transform.pos.x;
                    ship.pos.y = transform.pos.y;
                    ship.pos.z = transform.pos.z;
                    ship.vel.x = transform.vel.x;
                    ship.vel.y = transform.vel.y;
                    ship.vel.z = transform.vel.z;
                  }
                }
              }
            } else if (data.transforms) {
              // Legacy: array of objects
              for (const transform of data.transforms) {
                const ship =
                  state.shipIndex?.get(transform.shipId) ??
                  state.ships.find((s) => s.id === transform.shipId);
                if (ship) {
                  ship.pos.x = transform.pos.x;
                  ship.pos.y = transform.pos.y;
                  ship.pos.z = transform.pos.z;
                  ship.vel.x = transform.vel.x;
                  ship.vel.y = transform.vel.y;
                  ship.vel.z = transform.vel.z;
                }
              }
            }
            return;
          }
        });

        w.postMessage({ type: 'init-physics' });

        // Expose a small shim for callers that expects physicsStepper API
        (state as any).physicsStepper = {
          initDone: false,
          step(dt: number) {
            try {
              // Send current ship data to worker only if it has changed
              const currentVersion = state.shipDataVersion;
              if (currentVersion !== lastShipDataVersion) {
                // Pack ship data into a Float32Array for efficient transfer
                // Each ship: id, pos.x, pos.y, pos.z, vel.x, vel.y, vel.z (7 elements)
                const shipDataArray = new Float32Array(state.ships.length * 7);
                let offset = 0;
                for (const ship of state.ships) {
                  shipDataArray[offset++] = ship.id;
                  shipDataArray[offset++] = ship.pos.x;
                  shipDataArray[offset++] = ship.pos.y;
                  shipDataArray[offset++] = ship.pos.z;
                  shipDataArray[offset++] = ship.vel.x;
                  shipDataArray[offset++] = ship.vel.y;
                  shipDataArray[offset++] = ship.vel.z;
                }
                w.postMessage({ type: 'update-ships', payload: { ships: shipDataArray } }, [
                  shipDataArray.buffer,
                ]);
                lastShipDataVersion = currentVersion;
              }

              // Step physics
              w.postMessage({ type: 'step-physics', payload: { dt } });
            } catch (_e) {
              void _e; /* ignore */
            }
          },
          dispose() {
            try {
              w.postMessage({ type: 'dispose-physics' });
            } catch (_e) {
              void _e; /* ignore */
            }
          },
        };

        // Wait a short time for readiness, then mark initDone if ready
        setTimeout(() => {
          if ((state as any).physicsStepper) (state as any).physicsStepper.initDone = ready;
        }, 200);
      }
    } catch (_e) {
      void _e; // Fallback to in-process physics stepper
      try {
        const ps = await createPhysicsStepper(state as any);
        (state as any).physicsStepper = ps;
      } catch (ee) {
        void ee; /* ignore */
      }
    }
  })();

  // Wait for GLTF models to load before spawning ships and creating renderer
  // This ensures ships use GLTF prototypes instead of placeholder geometry
  (async () => {
    try {
      // Guard GLTF preloads behind configuration flag to avoid noisy 404s
      const shouldLoadModels = (RendererConfig as any)?.loadGltfModels ?? false;
      if (shouldLoadModels) {
        // Wait for GLTF models to load first
        try {
          const { preloadShipModels } = await import('./core/shipModelLoader.js');
          await preloadShipModels(state, ['red', 'blue']);
          logger.debug('[main.ts] GLTF models loaded, now spawning ships');

          // Register prototypes with the shipInstancer
          try {
            const { registerPrototypesFromPool } = await import('./renderer/meshFactory.js');
            registerPrototypesFromPool(state);
            logger.debug('[main.ts] Successfully registered GLTF prototypes with shipInstancer');
          } catch (err) {
            console.warn('[main.ts] Failed to register GLTF prototypes:', err);
          }
        } catch (err) {
          console.warn('[main.ts] preloadShipModels failed:', err);
        }
      }
    } catch (_e) {
      void _e;
    }

    // Now spawn fleets and create renderer - GLTF models should be available
    spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
    spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
    reFormFleets(state);
    const renderer = createThreeRenderer(state, ui.canvas);
    state.renderer = renderer;
    wireControls(state, ui);
    setupCameraControls(state, ui.canvas);
    setupPerfOverlay();
    startLoops(state, ui);
    // Gate noisy instancer debug hooks behind a URL parameter so they are
    // disabled by default in production. To enable, append ?instancerDebug=1
    // or ?instancerDebug=true to the app URL.
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams.get('instancerDebug');
      const enabled = p === '1' || p === 'true';
      if (enabled) {
        // Use typed globals on window rather than `any` casts so the linter is happy.
        try {
          window.DEBUG_SHIP_INSTANCER = true;
        } catch (_e) {
          void _e;
        }
        try {
          window.__shipInstancer = shipInstancer;
        } catch (_e) {
          void _e;
        }
        // One-shot sample dump to verify wiring
        try {
          shipInstancer.debugDumpSample?.();
        } catch (_e) {
          void _e;
        }
      } else {
        try {
          window.DEBUG_SHIP_INSTANCER = undefined;
        } catch (_e) {
          void _e;
        }
        try {
          window.__shipInstancer = undefined;
        } catch (_e) {
          void _e;
        }
      }
    } catch (_e) {
      void _e;
    }
  })();
}

// Boot
// Initialize logger debug mode from global game config so devs can toggle verbosity
logger.setDebug(!!DefaultGameConfig.ui.showDebugInfo);

// Helper: enable perf collector when URL has ?debugPerf=1. Safe to call multiple times.
window.addEventListener('DOMContentLoaded', () => {
  try {
    enablePerfCollectorIfRequested();
  } catch {}
  initGame();
});
