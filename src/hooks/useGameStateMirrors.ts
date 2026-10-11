import { useEffect } from 'react';
import type { GameState } from '../types/index.js';
import { mirrorHudHealthBarsFlag, useUiStore } from '../game/uiStore.js';
import { reportConfigError } from '../utils/errorReporting.js';

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

/**
 * Mirrors UI store state onto the canonical `GameState` for core systems:
 * pause/time-scale, simulation profiling flags, the AI-v2 enable guard, and the
 * HUD health-bars flag. Reads the needed UI values itself so consumers do not
 * have to subscribe to them.
 */
export function useGameStateMirrors(state: GameState | null): void {
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const simProfileSubsystems = useUiStore((s) => s.simProfileSubsystems);
  const simProfileSampleRate = useUiStore((s) => s.simProfileSampleRate);
  const simEnableSubsystemGuards = useUiStore((s) => s.simEnableSubsystemGuards);
  const aiV2Enabled = useUiStore((s) => s.aiV2Enabled);
  const hudHealthBarsEnabled = useUiStore((s) => s.hudHealthBarsEnabled);

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
}
