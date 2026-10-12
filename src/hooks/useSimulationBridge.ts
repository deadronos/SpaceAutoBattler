import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  SimulationBridge,
  shouldDebugWorkerSimulation,
  shouldEnableWorkerSimulation,
} from '../game/SimulationBridge.js';
import { useUiStore } from '../app/uiStore.js';
import { reportE2EError, reportConfigError } from '../utils/errorReporting.js';

export interface SimulationBridgeHandle {
  bridge: SimulationBridge | null;
  bridgeRef: RefObject<SimulationBridge | null>;
}

/**
 * Owns the worker-bridge lifecycle: constructs the `SimulationBridge` when the
 * worker simulation is enabled, keeps it in a ref (for `installE2eDebugSurface`),
 * mirrors pause/AI-override UI state onto it, and disposes it on unmount.
 */
export function useSimulationBridge(): SimulationBridgeHandle {
  const simBridgeRef = useRef<SimulationBridge | null>(null);
  const [simBridge, setSimBridge] = useState<SimulationBridge | null>(null);
  const paused = useUiStore((s) => s.paused);
  const aiVerticalEnabled = useUiStore((s) => s.aiVerticalEnabled);
  const aiEngagementBoostEnabled = useUiStore((s) => s.aiEngagementBoostEnabled);
  const aiTickRateExperimentEnabled = useUiStore((s) => s.aiTickRateExperimentEnabled);
  const aiRangePolicy = useUiStore((s) => s.aiRangePolicy);
  const aiSmoothingEnabled = useUiStore((s) => s.aiSmoothingEnabled);
  const aiHysteresisEnabled = useUiStore((s) => s.aiHysteresisEnabled);
  const aiVerticalDampingEnabled = useUiStore((s) => s.aiVerticalDampingEnabled);

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

  return { bridge: simBridge, bridgeRef: simBridgeRef };
}
