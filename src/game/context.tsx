import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState, GameEntity } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from './state.js';
import { updateGame } from './systems.js';
import { mirrorHudHealthBarsFlag, useUiStore } from './uiStore.js';
import {
  SimulationBridge,
  shouldDebugWorkerSimulation,
  shouldEnableWorkerSimulation,
  shouldRenderWorkerShipsOnly,
} from './SimulationBridge.js';
import { reportE2EError, reportConfigError } from '../utils/errorReporting.js';

let warnedAiDisableContext = false;
function warnAiDisableInContext(): void {
  if (warnedAiDisableContext) return;
  warnedAiDisableContext = true;
  try {
    globalThis.console?.warn?.('AI v2 disable attempts are ignored in the simulation context.');
  } catch (error) {
    // Expected: Console may not be available in some environments
    reportConfigError('console.warn', error);
  }
}

interface GameContextValue {
  state: GameState | null;
}

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

const GameContext = createContext<GameContextValue | undefined>(undefined);
const SimulationBridgeContext = createContext<SimulationBridge | null>(null);

type GameProviderProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function GameProvider({ children, fallback = null }: GameProviderProps): React.ReactElement {
  const [state, setState] = useState<GameState | null>(null);
  const simBridgeRef = useRef<SimulationBridge | null>(null);
  const [simBridge, setSimBridge] = useState<SimulationBridge | null>(null);
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const aiV2Enabled = useUiStore((s) => s.aiV2Enabled);
  const hudHealthBarsEnabled = useUiStore((s) => s.hudHealthBarsEnabled);
  const aiVerticalEnabled = useUiStore((s) => s.aiVerticalEnabled);
  const aiEngagementBoostEnabled = useUiStore((s) => s.aiEngagementBoostEnabled);
  const aiTickRateExperimentEnabled = useUiStore((s) => s.aiTickRateExperimentEnabled);
  const aiRangePolicy = useUiStore((s) => s.aiRangePolicy);
  const aiSmoothingEnabled = useUiStore((s) => s.aiSmoothingEnabled);
  const aiHysteresisEnabled = useUiStore((s) => s.aiHysteresisEnabled);
  const aiVerticalDampingEnabled = useUiStore((s) => s.aiVerticalDampingEnabled);
  const simProfileSubsystems = useUiStore((s) => s.simProfileSubsystems);
  const simProfileSampleRate = useUiStore((s) => s.simProfileSampleRate);
  const simEnableSubsystemGuards = useUiStore((s) => s.simEnableSubsystemGuards);

  // Phase 1 worker smoke-test: start a worker when explicitly enabled.
  useEffect(() => {
    if (!shouldEnableWorkerSimulation()) return;
    if (simBridgeRef.current) return;

    const bridge = new SimulationBridge({
      seed: 1337,
      capacity: 4096,
      startPaused: paused,
      aiOverrides: {
        aiVerticalEnabled,
        aiEngagementBoostEnabled,
        aiTickRateExperimentEnabled,
        aiRangePolicy,
        aiSmoothingEnabled,
        aiHysteresisEnabled,
        aiVerticalDampingEnabled,
      },
      debug: shouldDebugWorkerSimulation(),
    });
    simBridgeRef.current = bridge;
    setSimBridge(bridge);

    void bridge.ready().catch((error) => {
      try {
        globalThis.console?.error?.('[GameProvider] worker init failed', error);
      } catch (logError) {
        reportConfigError('console.error.worker-init', logError);
      }
      reportE2EError('worker-init', error);
    });

    return () => {
      simBridgeRef.current?.dispose();
      simBridgeRef.current = null;
      setSimBridge(null);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bridge = simBridgeRef.current;
    if (!bridge) return;
    bridge.setPaused(paused);
    bridge.setAiOverrides({
      aiVerticalEnabled,
      aiEngagementBoostEnabled,
      aiTickRateExperimentEnabled,
      aiRangePolicy,
      aiSmoothingEnabled,
      aiHysteresisEnabled,
      aiVerticalDampingEnabled,
    });
  }, [
    paused,
    aiVerticalEnabled,
    aiEngagementBoostEnabled,
    aiTickRateExperimentEnabled,
    aiRangePolicy,
    aiSmoothingEnabled,
    aiHysteresisEnabled,
    aiVerticalDampingEnabled,
  ]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const renderWorkerOnly = shouldRenderWorkerShipsOnly();
      const created = await createGameState({ renderOnly: renderWorkerOnly });
      if (!renderWorkerOnly) {
        spawnInitialFleets(created);
      }
      // E2E-only debug surface: when the URL contains ?e2e=1, expose a minimal
      // introspection API on window for Playwright to poll entity counts. This
      // avoids adding app-visible UI and keeps all runtime state on GameState.
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.has('e2e')) {
            const win = window as SabWindow;
            win.__SAB = {
              getCounts: () => ({
                ships: created.queries.ships.entities.length,
                projectiles: created.queries.projectiles.entities.length,
              }),
              getWorkerCounts: () => {
                const bridge = simBridgeRef.current;
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
                const bridge = simBridgeRef.current;
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
                  const ships = created.queries.ships.entities;
                  return {
                    tick: created.simulation.lastTickIndex,
                    time: created.time,
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
                  return { tick: created.simulation.lastTickIndex, time: created.time, ships: [] };
                }
              },
              sampleWorkerShipMotion: (limit = 10) => {
                try {
                  const bridge = simBridgeRef.current;
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
                  for (let i = 0; i < steps; i += 1) updateGame(created, dt);
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
                    () => updateGame(created, dt),
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
          }
        }
      } catch (error) {
        // Expected: E2E hooks are best-effort; must not interfere with app behavior
        reportE2EError('e2e-setup', error);
      }
      if (!cancelled) {
        setState(created);
      } else {
        disposeGameState(created);
      }
    })();

    return () => {
      cancelled = true;
      setState((current) => {
        if (current) {
          disposeGameState(current);
        }
        return null;
      });
    };
  }, []);

  // Mirror UI state to GameState for core systems.
  useEffect(() => {
    if (!state) return;
    state.paused = paused;
    state.timeScale = timeScale;
  }, [state, paused, timeScale]);

  useEffect(() => {
    if (!state) return;
    state.simulation.profileSubsystems = simProfileSubsystems;
    state.simulation.profileSampleRate = simProfileSampleRate;
    state.simulation.enableSubsystemGuards = simEnableSubsystemGuards;
  }, [state, simProfileSubsystems, simProfileSampleRate, simEnableSubsystemGuards]);

  useEffect(() => {
    if (!state?.ai) return;
    if (!aiV2Enabled) {
      warnAiDisableInContext();
      try {
        const store = useUiStore.getState();
        if (!store.aiV2Enabled) {
          store.setAiV2Enabled(true);
        }
      } catch (error) {
        // Expected: Store may be in invalid state during hot reload
        reportConfigError('aiV2Enabled.sync', error);
      }
    }
    state.ai.enabled = true;
  }, [state, aiV2Enabled]);

  useEffect(() => {
    if (!state) return;
    mirrorHudHealthBarsFlag(state, hudHealthBarsEnabled);
  }, [state, hudHealthBarsEnabled]);

  return (
    <SimulationBridgeContext.Provider value={simBridge}>
      <GameContext.Provider value={{ state }}>{state ? children : fallback}</GameContext.Provider>
    </SimulationBridgeContext.Provider>
  );
}

export function useGameState(): GameState {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameState must be used inside a GameProvider');
  }

  if (!context.state) {
    throw new Error('Game state is not ready yet');
  }

  return context.state;
}

export function useOptionalGameState(): GameState | null {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useOptionalGameState must be used inside a GameProvider');
  }
  return context.state;
}

export function useOptionalSimulationBridge(): SimulationBridge | null {
  return useContext(SimulationBridgeContext);
}
