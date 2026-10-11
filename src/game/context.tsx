import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../types/index.js';
import { createGameState, disposeGameState, spawnInitialFleets } from './state.js';
import { mirrorHudHealthBarsFlag, useUiStore } from './uiStore.js';
import { installE2eDebugSurface } from './e2eDebugSurface.js';
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
