/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createInitialState,
  resetState as _resetState,
  spawnFleet,
  spawnShip as _spawnShip,
} from './core/gameState.js';
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

// Lightweight helper types for safe 'loose' access to globals/configs without
// using `any` (we prefer `unknown` and narrow to specific properties when
// needed). This reduces @typescript-eslint/no-explicit-any warnings while
// keeping runtime behavior identical.
type LooseDict = Record<string, unknown>;
const G = globalThis as unknown as LooseDict;
const W = typeof window !== 'undefined' ? (window as unknown as LooseDict) : ({} as LooseDict);
const RC = RendererConfig as unknown as LooseDict;

// Expose canonical Three.js runtime to globalThis so modules using different
// bundling/resolution still reference the same constructors at runtime.
// This mitigates "Multiple instances of Three.js being imported" issues
// which can break attribute/constructor identity used by the renderer.
// Keep this as early as possible in the bootstrap sequence.

if (!('THREE' in G)) {
  G.THREE = THREE;
}
import type { GameState as _GameStateType, UIElements as _UIElementsType } from './types/index.js';
import { createThreeRenderer } from './renderer/threeRenderer.js';
import { shipInstancer } from './renderer/shipInstancer.js';
import { RendererConfig } from './config/rendererConfig.js';
import { createPhysicsStepper, PhysicsStepper } from './core/physics.js';
import { CameraConfig as _CameraConfig } from './config/cameraConfig.js';
import { FleetConfig } from './config/fleetConfig.js';
// DefaultSimConfig not used here; keep config imports minimal to avoid unused-import ESLint errors
import { getSVGLoader, loadSVGAsset } from './core/svgLoader.js';
import * as logger from './utils/logger.js';
import { DefaultGameConfig } from './config/gameConfig.js';
import { defaultSVGConfig, getShipSVGUrls } from './config/svgConfig.js';
import { perf as _perf } from './utils/perf.js';
import { bindUI } from './ui/bindUI.js';
import { randomClass as _randomClass } from './utils/randomShipClass.js';
import { reFormFleets } from './core/reFormFleets.js';
import { startLoops } from './core/startLoops.js';
import { createUnifiedEffectsManager } from './renderer/unifiedEffectsManager.js';
import { ProjectileSystem } from './core/systems/projectileSystem.js';
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

export function initGame(seed?: string) {
  const ui = bindUI();
  const state = createInitialState(seed);
  // Lightweight alias to avoid repeated `as any` casts in this large bootstrap file.
  const _S = state as unknown as LooseDict;
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
          if (typeof W.createImageBitmap === 'function') {
            // createImageBitmap may be present on window in some browsers
            bitmap = await (W.createImageBitmap as unknown as typeof createImageBitmap)(canvas);
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
  const gltfModeEnabled = !!(RC.loadGltfModels as unknown as boolean);
  const svgDisabled = !!(RC.disableSvgSubsystem as unknown as boolean);

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
  W.debugSVG = {
    // Get SVG loader stats (no-op when GLTF mode enabled)
    getStats: (): { cachedAssets: number } | any => {
      if ((RC.loadGltfModels as unknown as boolean) || svgDisabled) {
        logger.debug(
          '[SVG Debug] GLTF mode enabled or SVG subsystem disabled; SVG loader stats are disabled',
        );
        return { cachedAssets: 0 };
      }
      if (!svgLoader) return { cachedAssets: 0 };
      const stats = svgLoader.getCacheStats();
      logger.debug('[SVG Debug] Cache stats:', stats);
      return stats;
    },

    // Manually reload all SVG assets
    reloadAll: async () => {
      if ((RC.loadGltfModels as unknown as boolean) || svgDisabled) {
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
      if ((RC.loadGltfModels as unknown as boolean) || svgDisabled) {
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
      if ((RC.loadGltfModels as unknown as boolean) || svgDisabled) {
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
  W.__appDebug = {
    getState: () => state,
    listAssetPool: () => Array.from((state.assetPool ?? new Map()).keys()),
    getAsset: (k: string) => (state.assetPool as Map<string, unknown>)?.get(k),
    // lazy loader wrappers to avoid bundling load-only code paths unless used
    preloadSingleShip: async (cls: string, team = 'red') => {
      try {
        const mod = await import('./core/shipModelLoader.js');
        // Dynamic import may return an untyped module; narrow with unknown
        const m = mod as unknown as { preloadSingleShip?: (...args: unknown[]) => unknown };
        return m.preloadSingleShip ? (m.preloadSingleShip(state, cls, team) as unknown) : null;
      } catch (err) {
        console.warn('preloadSingleShip failed', err);
        return null;
      }
    },
    preloadShipModels: async () => {
      try {
        const mod = await import('./core/shipModelLoader.js');
        const m2 = mod as unknown as { preloadShipModels?: (...args: unknown[]) => unknown };
        return m2.preloadShipModels
          ? (m2.preloadShipModels(state, ['red', 'blue']) as unknown)
          : null;
      } catch (err) {
        console.warn('preloadShipModels failed', err);
        return null;
      }
    },
    configurePerfScenario: (options?: {
      totalShips?: number;
      redShips?: number;
      blueShips?: number;
      seed?: string;
      running?: boolean;
    }) => {
      try {
        const opts = options ?? {};
        const toCount = (value: unknown): number | undefined => {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return undefined;
          }
          return Math.max(0, Math.floor(value));
        };
        const requestedTotal = toCount(opts.totalShips);
        const redCount = toCount(opts.redShips) ?? (requestedTotal !== undefined
          ? Math.floor(requestedTotal / 2)
          : FleetConfig.spawning.defaultFleetSize);
        const blueCount = toCount(opts.blueShips) ?? (requestedTotal !== undefined
          ? Math.max(0, requestedTotal - redCount)
          : FleetConfig.spawning.defaultFleetSize);
        const totalShips = requestedTotal ?? redCount + blueCount;

        _resetState(state as unknown as _GameStateType, opts.seed);
        spawnFleet(state, 'red', redCount);
        spawnFleet(state, 'blue', blueCount);
        reFormFleets(state);

        state.running = opts.running ?? true;
        state.speedMultiplier = 1;

        return {
          totalShips,
          redShips: redCount,
          blueShips: blueCount,
        };
      } catch (err) {
        console.warn('[__appDebug] configurePerfScenario failed', err);
        return null;
      }
    },
    // Helpers to manually trigger FX for debugging
    triggerExplosion: (pos?: { x: number; y: number; z: number }, intensity = 1.0) => {
      try {
        const p = pos ?? { x: 0, y: 0, z: 0 };
        const fx = (state as unknown as _GameStateType).unifiedFX;
        if (fx && typeof fx.handleExplosion === 'function') {
          void fx.handleExplosion(p as any, intensity);
          logger.info('[__appDebug] triggerExplosion called', p, intensity);
          return true;
        }
        logger.warn('[__appDebug] triggerExplosion failed: unifiedFX not available');
      } catch (e) {
        logger.warn('[__appDebug] triggerExplosion error', e);
      }
      return false;
    },
    triggerProjectileHit: (hit?: any) => {
      try {
        const ps = (state as unknown as _GameStateType).projectileSystem;
        if (!ps) {
          logger.warn('[__appDebug] triggerProjectileHit failed: projectileSystem not available');
          return false;
        }
        const h =
          hit ||
          ({
            type: 'hit',
            bulletId: 9999,
            timestamp: state.time,
            sourceShipId: state.ships[0]?.id ?? 1,
            targetId: state.ships[1]?.id ?? 2,
            hitResult: {
              bulletId: 9999,
              targetId: state.ships[1]?.id ?? 2,
              damage: 2,
              hitPosition: { x: 0, y: 0, z: 0 },
              penetrated: true,
            },
          } as any);
        (ps as any).emitEvent(h);
        logger.info('[__appDebug] triggerProjectileHit emitted', h);
        return true;
      } catch (e) {
        logger.warn('[__appDebug] triggerProjectileHit error', e);
        return false;
      }
    },
  } as unknown;

  // Try to run Rapier in a worker (simWorker). If that fails, fall back to in-thread physics stepper.
  (async () => {
    try {
      // Create a module worker for simWorker.ts (Webpack will emit a JS chunk)
      const useSimWorker = (RC.useSimWorker as unknown as boolean) ?? true;
      let w: Worker | null = null;
      // If the config opts out of creating a sim worker, run the physics stepper in-thread immediately
      if (!useSimWorker) {
        console.debug(
          '[main.ts] Skipping simWorker creation (RendererConfig.useSimWorker=false); using in-thread physics',
        );
        try {
          const ps = await createPhysicsStepper(state as unknown as _GameStateType);
          (state as unknown as _GameStateType).physicsStepper = ps;
        } catch (ee) {
          void ee; /* ignore and continue */
        }
        return; // no worker setup required
      }

      // Create a module worker for simWorker.ts (Webpack will emit a JS chunk)
      try {
        w = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        // If worker creation fails (CSP, wrong path, unsupported env), surface an explicit console error
        try {
          const _u = new URL(window.location.href);
          if (_u.searchParams.get('simDebug') === '1') {
            console.error('[main.ts] simWorker creation threw:', err);
          }
        } catch {
          /* ignore URL parse */
        }
        w = null;
      }
      let ready = false;
      let lastShipDataVersion = -1;

  if (w) {
        // Optional debug hook: expose the worker to window and mirror messages
        // when URL includes ?simDebug=1. This is intentionally gated so
        // production runs are unaffected and we avoid noisy logs.
        try {
          const _url = new URL(window.location.href);
          const dbg = _url.searchParams.get('simDebug');
          if (dbg === '1') {
            try {
              (window as any).__simWorker = w;
            } catch {
              /* ignore */
            }
            try {
              w.addEventListener('message', (ev) => {
                try {
                  // Keep this as info-level so it's visible in console when enabled
                  // but avoid throwing if console I/O fails in restricted envs.
                  console.info('[simDebug] worker -> main', ev.data);
                } catch {
                  /* ignore */
                }
              });
            } catch {
              /* ignore */
            }
            console.info('[main.ts] simDebug active: worker exposed at window.__simWorker');
          }
        } catch {
          /* ignore URL parsing failures */
        }

        w.addEventListener('message', (ev) => {
          const data = ev.data || {};
          const type = data.type;
          // Perf events from simWorker
          if (type === 'perf') {
            const perfObj = W.__perf as unknown as
              | { addEvent?: (arg: { name: string; ms: number }) => void }
              | undefined;
            if (perfObj && typeof perfObj.addEvent === 'function') {
              try {
                perfObj.addEvent({ name: data.name, ms: data.ms });
              } catch {
                /* ignore */
              }
              return;
            }
          }
          // init handshake
          if (type === 'init-physics-done') {
            ready = !!data.ok;
            return;
          }

          // AI init handshake
          if (type === 'init-ai-done') {
            aiReady = !!data.ok;
            if (!aiReady && data.error) {
              logger.warn('[main.ts] AI worker initialization failed:', data.error);
            }
            return;
          }

          // AI step results
          if (type === 'step-ai-done') {
            if (data.error) {
              logger.warn('[main.ts] AI step error:', data.error);
              return;
            }
            
            // Process AI results - update ship targets
            if (data.aiResultsBuffer && data.shipCount) {
              try {
                const aiResults = new Float32Array(data.aiResultsBuffer);
                const resultsPerShip = 3; // id, targetId, aiStateFlag
                
                for (let i = 0; i < data.shipCount; i++) {
                  const offset = i * resultsPerShip;
                  const shipId = aiResults[offset];
                  const targetId = aiResults[offset + 1] === -1 ? null : aiResults[offset + 1];
                  
                  // Find ship and update its target
                  const ship = state.shipIndex?.get(shipId) ?? state.ships.find(s => s.id === shipId);
                  if (ship) {
                    ship.targetId = targetId;
                  }
                }
              } catch (e) {
                logger.warn('[main.ts] Error processing AI results:', e);
              }
            }

            // Process AI-computed velocities, when provided. This updates the
            // canonical GameState velocities so the subsequent physics tick
            // streams non-zero values via update-velocities.
            if (data.aiVelBuffer) {
              try {
                const vArr = new Float32Array(data.aiVelBuffer);
                const stride = 4; // id, vx, vy, vz
                for (let i = 0; i < vArr.length; i += stride) {
                  const id = vArr[i];
                  const vx = vArr[i + 1];
                  const vy = vArr[i + 2];
                  const vz = vArr[i + 3];
                  const ship = state.shipIndex?.get(id) ?? state.ships.find(s => s.id === id);
                  if (ship) {
                    ship.vel.x = vx;
                    ship.vel.y = vy;
                    ship.vel.z = vz;
                  }
                }
              } catch (e) {
                logger.warn('[main.ts] Error processing AI velocity buffer:', e);
              }
            }

            // When AI runs in the worker, immediately stream updated velocities
            // and step physics with the same dt, ensuring no-frame delay.
            try {
              const useAIWorker = (RC.useAIWorker as unknown as boolean) ?? true;
              const useSimWorker = (RC.useSimWorker as unknown as boolean) ?? true;
              if (useSimWorker && useAIWorker) {
                const floatsPer = 4; // id, vx, vy, vz
                const velArray = new Float32Array(state.ships.length * floatsPer);
                let o = 0;
                for (const ship of state.ships) {
                  velArray[o++] = ship.id;
                  velArray[o++] = ship.vel.x;
                  velArray[o++] = ship.vel.y;
                  velArray[o++] = ship.vel.z;
                }
                w.postMessage(
                  { type: 'update-velocities', payload: { velocities: velArray } },
                  [velArray.buffer]
                );
                const defaultDt = 1 / (state.simConfig.tickRate || 60);
                const dtForPhysics = typeof lastAIDt === 'number' && lastAIDt > 0 ? lastAIDt : defaultDt;
                w.postMessage({ type: 'step-physics', payload: { dt: dtForPhysics } });
              }
            } catch (_e) {
              void _e;
            }
            return;
          }

          if (type === 'step-ai-error') {
            logger.warn('[main.ts] AI step error:', data.error);
            return;
          }

          // Bullet operation results
          if (type === 'fire-bullet-done') {
            // Bullet creation handled by worker, main thread just tracks success
            return;
          }

          if (type === 'remove-bullet-done') {
            // Bullet removal handled by worker
            return;
          }

          // step result: supports packed Float32Array buffer (transformsBuffer)
          if (type === 'step-physics-done') {
            // Handle bullet events first
            if (data.bulletEvents && Array.isArray(data.bulletEvents)) {
              for (const event of data.bulletEvents) {
                if (event.type === 'bullet-expired' && typeof event.bulletId === 'number') {
                  // Remove bullet from game state
                  const bulletIndex = state.bullets.findIndex((b) => b.id === event.bulletId);
                  if (bulletIndex >= 0) {
                    state.bullets.splice(bulletIndex, 1);
                  }
                  // Emit projectile expired event
                  try {
                    const projectileSystem = (state as any).projectileSystem;
                    if (projectileSystem && typeof projectileSystem.emitEvent === 'function') {
                      projectileSystem.emitEvent({
                        type: 'expired',
                        bulletId: event.bulletId,
                        timestamp: state.time,
                      });
                    }
                  } catch (_e) {
                    void _e;
                  }
                }
              }
            }

            // Handle transform buffer (ships and bullets)
            const buf =
              data.transformsBuffer || (data.transforms && data.transforms.buffer) || null;
            if (buf) {
              try {
                const arr = new Float32Array(buf);
                // Debug: when ?simDebug=1 is present, dump a preview of the
                // transforms buffer so we can inspect whether the worker
                // packed NaN/Inf or unexpected values. Keep this gated to
                // avoid noisy logs in normal runs.
                try {
                  const _u = new URL(window.location.href);
                  if (_u.searchParams.get('simDebug') === '1') {
                    const previewLen = Math.min(64, arr.length);
                    const preview = Array.from(arr.subarray(0, previewLen));
                    try {
                      console.info('[main.ts][simDebug] transformsBuffer preview (first %d floats):', previewLen, preview);
                    } catch {
                      /* ignore console failures in restricted envs */
                    }
                  }
                } catch {
                  /* ignore URL parsing failures */
                }
                let offset = 0;
                
                // Read ship count and ship data
                const shipCount = Math.floor(arr[offset++]);
                // Debug: sample parsed ship entries when simDebug=1 is present.
                let parsedSample: Array<{ id: number; px: number; py: number; pz: number; vx: number; vy: number; vz: number }> | null = null;
                try {
                  const _u2 = new URL(window.location.href);
                  if (_u2.searchParams.get('simDebug') === '1') parsedSample = [];
                } catch {
                  /* ignore */
                }

                for (let i = 0; i < shipCount; i++) {
                  const id = Math.floor(arr[offset++]);
                  const px = arr[offset++];
                  const py = arr[offset++];
                  const pz = arr[offset++];
                  const vx = arr[offset++];
                  const vy = arr[offset++];
                  const vz = arr[offset++];

                  if (parsedSample && parsedSample.length < 6) {
                    parsedSample.push({ id, px, py, pz, vx, vy, vz });
                  }

                  const ship = state.shipIndex?.get(id) ?? state.ships.find((s) => s.id === id);
                  if (ship) {
                    ship.pos.x = px;
                    ship.pos.y = py;
                    ship.pos.z = pz;
                    ship.vel.x = vx;
                    ship.vel.y = vy;
                    ship.vel.z = vz;
                  } else {
                    // ship not found in state; ignore parsed values
                  }
                }

                if (parsedSample) {
                  try {
                    console.info('[main.ts][simDebug] parsed ships sample:', parsedSample);
                  } catch {
                    /* ignore */
                  }
                }

                // Read bullet count and bullet data
                if (offset < arr.length) {
                  const bulletCount = Math.floor(arr[offset++]);
                  for (let i = 0; i < bulletCount; i++) {
                    const bulletId = Math.floor(arr[offset++]);
                    const bullet = state.bullets.find((b) => b.id === bulletId);
                    if (bullet) {
                      // Store previous position for interpolation
                      bullet.prevPos = { ...bullet.pos };
                      bullet.pos.x = arr[offset++];
                      bullet.pos.y = arr[offset++];
                      bullet.pos.z = arr[offset++];
                      bullet.vel.x = arr[offset++];
                      bullet.vel.y = arr[offset++];
                      bullet.vel.z = arr[offset++];
                      bullet.ttl = arr[offset++];
                    } else {
                      offset += 7; // Skip position, velocity, and ttl data
                    }
                  }
                }
              } catch (_e) {
                void _e; // Fallback to older object-based transforms if parsing fails
                const transforms = data.transforms || [];
                const bulletTransforms = data.bulletTransforms || [];
                
                // Optional payload size audit
                try {
                  const perfObj = W.__perf as unknown as
                    | { addEvent?: (arg: { name: string; ms: number }) => void }
                    | undefined;
                  if (perfObj && typeof perfObj.addEvent === 'function')
                    perfObj.addEvent({
                      name: 'physics.payload.recvKB',
                      ms: (JSON.stringify(transforms).length + JSON.stringify(bulletTransforms).length) / 1000,
                    });
                } catch (_e) {
                  void _e;
                }

                // Handle ships
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

                // Handle bullets
                for (const bulletTransform of bulletTransforms) {
                  const bullet = state.bullets.find((b) => b.id === bulletTransform.bulletId);
                  if (bullet) {
                    bullet.prevPos = { ...bullet.pos };
                    bullet.pos.x = bulletTransform.pos.x;
                    bullet.pos.y = bulletTransform.pos.y;
                    bullet.pos.z = bulletTransform.pos.z;
                    bullet.vel.x = bulletTransform.vel.x;
                    bullet.vel.y = bulletTransform.vel.y;
                    bullet.vel.z = bulletTransform.vel.z;
                    bullet.ttl = bulletTransform.ttl;
                  }
                }
              }
            } else if (data.transforms || data.bulletTransforms) {
              // Legacy: array of objects
              const transforms = data.transforms || [];
              const bulletTransforms = data.bulletTransforms || [];
              
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

              for (const bulletTransform of bulletTransforms) {
                const bullet = state.bullets.find((b) => b.id === bulletTransform.bulletId);
                if (bullet) {
                  bullet.prevPos = { ...bullet.pos };
                  bullet.pos.x = bulletTransform.pos.x;
                  bullet.pos.y = bulletTransform.pos.y;
                  bullet.pos.z = bulletTransform.pos.z;
                  bullet.vel.x = bulletTransform.vel.x;
                  bullet.vel.y = bulletTransform.vel.y;
                  bullet.vel.z = bulletTransform.vel.z;
                  bullet.ttl = bulletTransform.ttl;
                }
              }
            }
            return;
          }
        });

  w.postMessage({ type: 'init-physics' });

        // Initialize AI in the same worker
        let aiReady = false;
        let lastAIDt = 0; // dt most recently sent to AI worker
        // Initialize AI in the worker and provide the canonical RNG seed so
        // AI inside the worker uses the same deterministic RNG as the main thread.
        w.postMessage({
          type: 'init-ai',
          payload: {
            simConfig: state.simConfig,
            behaviorConfig: state.behaviorConfig,
            // Prefer the canonical seed stored on GameState.rng
            rngSeed: state.rng?.seed ?? String(0),
          },
        });

        // Expose a small shim for callers that expects physicsStepper API
        (state as unknown as _GameStateType).physicsStepper = ({
          initDone: false,
          world: undefined, // Worker mode doesn't expose world directly
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
              // If AI runs in the worker and is ready, defer velocities + physics
              // until step-ai-done so we can apply fresh AI velocities first.
              const useAIWorker = (RC.useAIWorker as unknown as boolean) ?? true;
              if (!aiReady || !useAIWorker) {
                // No AI worker: stream velocities and step physics immediately
                try {
                  const floatsPer = 4; // id, vx, vy, vz
                  const velArray = new Float32Array(state.ships.length * floatsPer);
                  let o = 0;
                  for (const ship of state.ships) {
                    velArray[o++] = ship.id;
                    velArray[o++] = ship.vel.x;
                    velArray[o++] = ship.vel.y;
                    velArray[o++] = ship.vel.z;
                  }
                  w.postMessage(
                    { type: 'update-velocities', payload: { velocities: velArray } },
                    [velArray.buffer]
                  );
                } catch (_ee) {
                  void _ee;
                }
                // Step physics now
                w.postMessage({ type: 'step-physics', payload: { dt } });
              }
            } catch (_e) {
              void _e; /* ignore */
            }
          },
          stepAI(dt: number) {
            if (!aiReady) return; // AI not ready yet
            try {
              lastAIDt = dt;
              // Pack ship data for AI (more fields than physics)
              const floatsPerShip = 12; // id, px, py, pz, vx, vy, vz, health, targetId, team, class, speed
              const shipsBuffer = new Float32Array(state.ships.length * floatsPerShip);
              for (let i = 0; i < state.ships.length; i++) {
                const ship = state.ships[i];
                const base = i * floatsPerShip;
                shipsBuffer[base + 0] = ship.id;
                shipsBuffer[base + 1] = ship.pos.x;
                shipsBuffer[base + 2] = ship.pos.y;
                shipsBuffer[base + 3] = ship.pos.z;
                shipsBuffer[base + 4] = ship.vel.x;
                shipsBuffer[base + 5] = ship.vel.y;
                shipsBuffer[base + 6] = ship.vel.z;
                shipsBuffer[base + 7] = ship.health;
                shipsBuffer[base + 8] = ship.targetId || -1;
                shipsBuffer[base + 9] = ship.team === 'red' ? 0 : 1;
                shipsBuffer[base + 10] = 0; // ship class placeholder
                shipsBuffer[base + 11] = ship.speed ?? 0;
              }
              // Pack bullet data if needed
              const floatsPerBullet = 11; // id, px, py, pz, vx, vy, vz, ttl, damage, ownerShipId, ownerTeam
              const bulletsBuffer = new Float32Array(state.bullets.length * floatsPerBullet);
              for (let i = 0; i < state.bullets.length; i++) {
                const bullet = state.bullets[i];
                const base = i * floatsPerBullet;
                bulletsBuffer[base + 0] = bullet.id;
                bulletsBuffer[base + 1] = bullet.pos.x;
                bulletsBuffer[base + 2] = bullet.pos.y;
                bulletsBuffer[base + 3] = bullet.pos.z;
                bulletsBuffer[base + 4] = bullet.vel.x;
                bulletsBuffer[base + 5] = bullet.vel.y;
                bulletsBuffer[base + 6] = bullet.vel.z;
                bulletsBuffer[base + 7] = bullet.ttl;
                bulletsBuffer[base + 8] = bullet.damage;
                bulletsBuffer[base + 9] = bullet.ownerShipId;
                bulletsBuffer[base + 10] = bullet.ownerTeam === 'red' ? 0 : 1;
              }
              // Send AI step message
              w.postMessage({
                type: 'step-ai',
                payload: {
                  dt,
                  shipsBuffer: shipsBuffer.buffer,
                  bulletsBuffer: bulletsBuffer.buffer,
                  behaviorConfig: state.behaviorConfig,
                  tick: state.tick,
                },
              }, [shipsBuffer.buffer, bulletsBuffer.buffer]);
            } catch (e) {
              logger.warn('[main.ts] Error sending AI step:', e);
            }
          },
          dispose() {
            try {
              w.postMessage({ type: 'dispose-physics' });
              w.postMessage({ type: 'dispose-ai' });
            } catch (_e) {
              void _e; /* ignore */
            }
          },
          // Stub implementations for worker mode (these would need proper implementation)
          addShip: () => null,
          removeShip: () => {},
          raycast: () => null,
          sphereCast: () => [],
          applyForce: () => {},
          setGravity: () => {},
        }) as PhysicsStepper;

        // Wait a short time for readiness, then mark initDone if ready
        setTimeout(() => {
          const ps = (state as unknown as _GameStateType).physicsStepper;
          if (ps) ps.initDone = ready;
        }, 200);
      }
    } catch (_e) {
      // If any top-level worker bootstrap error happened, surface a console warning when simDebug=1
      try {
        const _u2 = new URL(window.location.href);
        if (_u2.searchParams.get('simDebug') === '1') {
          console.warn('[main.ts] Worker bootstrap failed, falling back to in-thread physics:', _e);
        }
      } catch {
        /* ignore */
      }
      void _e; // Fallback to in-process physics stepper
      try {
        const ps = await createPhysicsStepper(state as unknown as _GameStateType);
        (state as unknown as _GameStateType).physicsStepper = ps;
        // Register GLTF prototypes for instancing (best-effort)
        try {
          const { registerPrototypesFromPool } = await import('./renderer/meshFactory.js');
          registerPrototypesFromPool(state);
          logger.debug('[main.ts] Successfully registered GLTF prototypes with shipInstancer');
        } catch (err) {
          console.warn('[main.ts] Failed to register GLTF prototypes:', err);
        }
      } catch (err) {
        console.warn('[main.ts] Fallback to in-thread physics failed:', err);
      }

    }

    // Now spawn fleets and create renderer - GLTF models should be available
    spawnFleet(state, 'red', FleetConfig.spawning.defaultFleetSize);
    spawnFleet(state, 'blue', FleetConfig.spawning.defaultFleetSize);
    reFormFleets(state);
    const renderer = createThreeRenderer(state, ui.canvas);
    state.renderer = renderer;
    // Create a central ProjectileSystem instance for this app runtime and
    // attach it to state so other modules can reuse it. Tests may still
    // create local instances; this global instance is intended for the
    // browser runtime wiring.
    try {
      const projectileSystem = new ProjectileSystem(state as unknown as _GameStateType);
      (state as unknown as _GameStateType).projectileSystem = projectileSystem;
    } catch (_e) {
      void _e;
    }

    // Create unified effects manager and expose on state for wiring
    try {
      const unifiedFX = createUnifiedEffectsManager(state as unknown as _GameStateType);
      // store on state with proper typing
      (state as unknown as _GameStateType).unifiedFX = unifiedFX;

      // Wire projectile events from the authoritative ProjectileSystem we
      // created above so hits trigger unified visual effects.
      try {
        const ps = (state as unknown as _GameStateType).projectileSystem;
        if (ps) {
          logger.info('[main] wiring projectile event handler');
          ps.onProjectileEvent((evt) => {
            try {
              try {
                logger.info('[main] received projectile event', evt.type, evt.bulletId);
              } catch {
                /* ignore logging failure */
              }

              // Only trigger explosion visuals when the hit results in the
              // target ship being destroyed (health <= 0). The ProjectileSystem
              // applies damage before emitting the 'hit' event, so we can check
              // the current ship health here.
              if (
                evt &&
                evt.type === 'hit' &&
                evt.hitResult &&
                evt.hitResult.hitPosition &&
                typeof evt.targetId !== 'undefined'
              ) {
                const targetId = evt.targetId as number;
                const targetShip =
                  (state as unknown as _GameStateType).shipIndex?.get(targetId) ??
                  (state as unknown as _GameStateType).ships.find((s: any) => s.id === targetId);

                const isDead = targetShip ? (targetShip.health ?? 0) <= 0 : false;

                // Log target health for debugging/testing visibility
                try {
                  logger.info('[main] hit target check', { targetId, health: targetShip?.health });
                } catch {
                  /* ignore */
                }

                if (isDead) {
                  const intensity = Math.min(2, 1 + (evt.hitResult.damage ?? 1) * 0.1);
                  try {
                    logger.info('[Explosions] Projectile hit explosion (kill)', {
                      position: evt.hitResult.hitPosition,
                      intensity,
                      damage: evt.hitResult.damage ?? null,
                      targetId,
                    });
                  } catch {
                    /* ignore logging failure */
                  }
                  void unifiedFX.handleExplosion(evt.hitResult.hitPosition, intensity);
                } else {
                  // Non-lethal hit: do not spawn full explosion FX. Keep a debug
                  // trace for developers.
                  try {
                    logger.debug('[Explosions] non-lethal hit, skipping explosion FX', {
                      targetId,
                      remainingHealth: targetShip?.health ?? null,
                    });
                  } catch {
                    /* ignore logging failure */
                  }
                  try {
                    // Trigger a cheap hit micro-FX (sparks / small camera nudge)
                    if (unifiedFX && typeof unifiedFX.handleHitEffect === 'function') {
                      unifiedFX.handleHitEffect(
                        evt.hitResult.hitPosition,
                        evt.hitResult.damage ?? 1,
                      );
                    }
                  } catch (_e) {
                    void _e;
                  }
                }
              }
            } catch (_e) {
              void _e;
            }
          });
        }
      } catch (_e) {
        void _e;
      }
    } catch (_e) {
      void _e;
    }
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

  return state;
}

// Boot
// Initialize logger debug mode from global game config so devs can toggle verbosity
logger.setDebug(!!DefaultGameConfig.ui.showDebugInfo);

// Helper: enable perf collector when URL has ?debugPerf=1. Safe to call multiple times.
window.addEventListener('DOMContentLoaded', () => {
  try {
    enablePerfCollectorIfRequested();
  } catch (_e) {
    void _e;
  }
  initGame();
});


