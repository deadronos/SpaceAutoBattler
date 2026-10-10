import type { GameEntity, GameState } from '../types/index.js';
import type { SimulationBridge } from './SimulationBridge.js';
import { updateGame } from './systems.js';
import { reportE2EError } from '../utils/errorReporting.js';
import { readQueryParam } from '../utils/queryParams.js';

interface SabDebugSurface {
  getCounts: () => { ships: number; projectiles: number };
  getWorkerCounts: () => {
    tick: number | null;
    ships: number | null;
    ready: boolean;
    usingShared: boolean;
    error: unknown;
  };
  getWorkerStatus: () => {
    ready: boolean;
    tick: number | null;
    shipCount: number | null;
    usingShared: boolean;
    error: unknown;
  };
  sampleShipMotion: () => {
    tick: number;
    time: number;
    ships: Array<{
      id: number;
      team: string | null;
      hull: string | null;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
      velocity: { x: number; y: number; z: number };
      angularVelocity: { x: number; y: number; z: number };
      lateralAcceleration: number;
    }>;
  };
  sampleWorkerShipMotion: (limit?: number) => {
    tick: number | null;
    shipCount: number | null;
    ships: Array<unknown>;
  };
  tick: (steps?: number, dt?: number) => void;
  startAutoTick: (dt?: number) => void;
  stopAutoTick: () => void;
}

type SabWindow = Window & {
  __SAB?: SabDebugSurface;
  __sabAutoTick__?: ReturnType<typeof setInterval> | null;
};

export interface E2eDebugSurfaceOptions {
  state: GameState;
  getBridge: () => SimulationBridge | null;
}

/**
 * Installs the E2E-only `window.__SAB` introspection surface when the URL
 * contains `?e2e`. This avoids adding app-visible UI and keeps all runtime
 * state on `GameState`. Best-effort: never throws.
 *
 * @param {E2eDebugSurfaceOptions} options - The current state and a bridge accessor.
 */
export function installE2eDebugSurface({ state, getBridge }: E2eDebugSurfaceOptions): void {
  try {
    if (typeof window === 'undefined') return;
    if (readQueryParam('e2e') === null) return;

    const win = window as SabWindow;
    win.__SAB = {
      getCounts: () => ({
        ships: state.queries.ships.entities.length,
        projectiles: state.queries.projectiles.entities.length,
      }),
      getWorkerCounts: () => {
        const bridge = getBridge();
        const sample = bridge?.sampleWorkerShipMotion(0);
        const status = bridge?.getStatus();
        return {
          tick: sample?.tick ?? null,
          ships: sample?.shipCount ?? null,
          ready: status?.ready ?? false,
          usingShared: status?.usingShared ?? false,
          error: status?.error ?? null,
        };
      },
      getWorkerStatus: () => {
        const bridge = getBridge();
        return (
          bridge?.getStatus() ?? {
            ready: false,
            tick: null,
            shipCount: null,
            usingShared: false,
            error: null,
          }
        );
      },
      sampleShipMotion: () => {
        try {
          const ships = state.queries.ships.entities;
          return {
            tick: state.simulation.lastTickIndex,
            time: state.time,
            ships: ships.map((entity: GameEntity) => {
              const transform = entity.transform;
              const ship = entity.ship;
              return {
                id: entity.id,
                team: ship?.team ?? null,
                hull: ship?.hull ?? null,
                position: transform
                  ? {
                      x: transform.position.x,
                      y: transform.position.y,
                      z: transform.position.z,
                    }
                  : { x: 0, y: 0, z: 0 },
                rotation: transform
                  ? {
                      x: transform.rotation.x,
                      y: transform.rotation.y,
                      z: transform.rotation.z,
                      w: transform.rotation.w,
                    }
                  : { x: 0, y: 0, z: 0, w: 1 },
                velocity: ship
                  ? { x: ship.velocity.x, y: ship.velocity.y, z: ship.velocity.z }
                  : { x: 0, y: 0, z: 0 },
                angularVelocity: ship
                  ? {
                      x: ship.angularVelocity.x,
                      y: ship.angularVelocity.y,
                      z: ship.angularVelocity.z,
                    }
                  : { x: 0, y: 0, z: 0 },
                lateralAcceleration: ship?.lateralAcceleration ?? 0,
              };
            }),
          };
        } catch (error) {
          // Expected: Ship data may be unavailable during state transitions
          reportE2EError('sampleShipMotion', error);
          return { tick: state.simulation.lastTickIndex, time: state.time, ships: [] };
        }
      },
      sampleWorkerShipMotion: (limit = 10) => {
        try {
          const bridge = getBridge();
          return (
            bridge?.sampleWorkerShipMotion(limit) ?? {
              tick: null,
              shipCount: null,
              ships: [],
            }
          );
        } catch (error) {
          reportE2EError('sampleWorkerShipMotion', error);
          return { tick: null, shipCount: null, ships: [] };
        }
      },
      // Advance the simulation by `steps` frames of `dt` seconds each
      tick: (steps = 1, dt = 1 / 60) => {
        try {
          for (let i = 0; i < steps; i += 1) updateGame(state, dt);
        } catch (error) {
          // Expected: Physics may fail during stress testing
          reportE2EError('tick', error);
        }
      },
      // Start an interval to progress the sim even if R3F frames don't run (e.g., WebKit headless)
      startAutoTick: (dt = 1 / 60) => {
        try {
          const w = window as SabWindow;
          if (w.__sabAutoTick__) return; // already running
          w.__sabAutoTick__ = setInterval(
            () => updateGame(state, dt),
            Math.max(1, Math.round(dt * 1000)),
          );
        } catch (error) {
          // Expected: setInterval may fail in restricted contexts
          reportE2EError('startAutoTick', error);
        }
      },
      stopAutoTick: () => {
        try {
          const w = window as SabWindow;
          if (w.__sabAutoTick__) {
            clearInterval(w.__sabAutoTick__);
            w.__sabAutoTick__ = null;
          }
        } catch (error) {
          // Expected: clearInterval may fail if interval was never started
          reportE2EError('stopAutoTick', error);
        }
      },
    };
  } catch (error) {
    // Expected: E2E hooks are best-effort; must not interfere with app behavior
    reportE2EError('e2e-setup', error);
  }
}
