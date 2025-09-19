import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from './state.js';

interface GameContextValue {
  state: GameState | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const created = await createGameState();
      spawnInitialFleets(created);
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
