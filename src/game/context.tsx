import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from './state.js';
import { updateGame } from './systems.js';
import { useUiStore } from './uiStore.js';

interface GameContextValue {
  state: GameState | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [state, setState] = useState<GameState | null>(null);
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);

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
                projectiles: created.queries.projectiles.entities.length
              }),
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
                  w[key] = setInterval(() => updateGame(created, dt), Math.max(1, Math.round(dt * 1000)));
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
              }
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

  return <GameContext.Provider value={{ state }}>{children}</GameContext.Provider>;
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
