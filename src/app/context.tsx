import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from '../game/state.js';
import { installE2eDebugSurface } from '../game/e2eDebugSurface.js';
import { SimulationBridge, shouldRenderWorkerShipsOnly } from '../game/SimulationBridge.js';
import { useSimulationBridge } from '../hooks/useSimulationBridge.js';
import { useGameStateMirrors } from '../hooks/useGameStateMirrors.js';

interface GameContextValue {
  state: GameState | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);
const SimulationBridgeContext = createContext<SimulationBridge | null>(null);

type GameProviderProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function GameProvider({ children, fallback = null }: GameProviderProps): React.ReactElement {
  const [state, setState] = useState<GameState | null>(null);
  const { bridge: simBridge, bridgeRef: simBridgeRef } = useSimulationBridge();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const renderWorkerOnly = shouldRenderWorkerShipsOnly();
      const created = await createGameState({ renderOnly: renderWorkerOnly });
      if (!renderWorkerOnly) {
        spawnInitialFleets(created);
      }
      // E2E-only debug surface: when the URL contains ?e2e=1, expose a minimal
      // introspection API on window for Playwright to poll entity counts.
      installE2eDebugSurface({ state: created, getBridge: () => simBridgeRef.current });
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGameStateMirrors(state);

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
