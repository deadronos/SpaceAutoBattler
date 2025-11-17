import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState, GameEntity } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from './state.js';
import { updateGame } from './systems.js';
import { mirrorHudHealthBarsFlag, useUiStore } from './uiStore.js';

let warnedAiDisableContext = false;
function warnAiDisableInContext(): void {
  if (warnedAiDisableContext) return;
  warnedAiDisableContext = true;
  try {
    globalThis.console?.warn?.('AI v2 disable attempts are ignored in the simulation context.');
  } catch {
    // ignore logging failures
  }
}

interface GameContextValue {
  state: GameState | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

type GameProviderProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function GameProvider({ children, fallback = null }: GameProviderProps): React.ReactElement {
  const [state, setState] = useState<GameState | null>(null);
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const aiV2Enabled = useUiStore((s) => s.aiV2Enabled);
  const hudHealthBarsEnabled = useUiStore((s) => s.hudHealthBarsEnabled);
  const simProfileSubsystems = useUiStore((s) => s.simProfileSubsystems);
  const simProfileSampleRate = useUiStore((s) => s.simProfileSampleRate);
  const simEnableSubsystemGuards = useUiStore((s) => s.simEnableSubsystemGuards);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const created = await createGameState();
      spawnInitialFleets(created);
      // E2E-only debug surface: when the URL contains ?e2e=1, expose a minimal
      // introspection API on window for Playwright to poll entity counts. This
      // avoids adding app-visible UI and keeps all runtime state on GameState.
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.has('e2e')) {
            (window as unknown as { __SAB?: any }).__SAB = {
              getCounts: () => ({
                ships: created.queries.ships.entities.length,
                projectiles: created.queries.projectiles.entities.length,
              }),
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
                } catch {
                  return { tick: created.simulation.lastTickIndex, time: created.time, ships: [] };
                }
              },
              // Advance the simulation by `steps` frames of `dt` seconds each
              tick: (steps = 1, dt = 1 / 60) => {
                try {
                  for (let i = 0; i < steps; i += 1) updateGame(created, dt);
                } catch {
                  /* ignore */
                }
              },
              // Start an interval to progress the sim even if R3F frames don't run (e.g., WebKit headless)
              startAutoTick: (dt = 1 / 60) => {
                try {
                  const key = '__sabAutoTick__';
                  const w = window as any;
                  if (w[key]) return; // already running
                  w[key] = setInterval(
                    () => updateGame(created, dt),
                    Math.max(1, Math.round(dt * 1000)),
                  );
                } catch {
                  /* ignore */
                }
              },
              stopAutoTick: () => {
                try {
                  const key = '__sabAutoTick__';
                  const w = window as any;
                  if (w[key]) {
                    clearInterval(w[key]);
                    w[key] = null;
                  }
                } catch {
                  /* ignore */
                }
              },
            };
          }
        }
      } catch {
        // best-effort; do not let diagnostics interfere with app behavior
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
      } catch {
        // ignore store sync failures
      }
    }
    state.ai.enabled = true;
  }, [state, aiV2Enabled]);

  useEffect(() => {
    if (!state) return;
    mirrorHudHealthBarsFlag(state, hudHealthBarsEnabled);
  }, [state, hudHealthBarsEnabled]);

  return (
    <GameContext.Provider value={{ state }}>{state ? children : fallback}</GameContext.Provider>
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
