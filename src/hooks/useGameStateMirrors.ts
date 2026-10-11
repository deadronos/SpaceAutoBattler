import { useEffect } from 'react';
import type { GameState } from '../types/index.js';
import {
  applyAiEnabled,
  applyPausedTimeScale,
  applySimulationProfile,
  mirrorHudHealthBarsFlag,
  useUiStore,
} from '../game/uiStore.js';

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
    applyPausedTimeScale(state, paused, timeScale);
  }, [state, paused, timeScale]);

  useEffect(() => {
    applySimulationProfile(
      state,
      simProfileSubsystems,
      simProfileSampleRate,
      simEnableSubsystemGuards,
    );
  }, [state, simProfileSubsystems, simProfileSampleRate, simEnableSubsystemGuards]);

  useEffect(() => {
    applyAiEnabled(state, aiV2Enabled);
  }, [state, aiV2Enabled]);

  useEffect(() => {
    mirrorHudHealthBarsFlag(state, hudHealthBarsEnabled);
  }, [state, hudHealthBarsEnabled]);
}
