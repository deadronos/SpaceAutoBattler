import { useUiStore, type UiState } from '../game/uiStore.js';
import { AI_CONFIG } from '../game/config.js';

export type HudToggleDefinition = {
  id: string;
  label: string;
  description?: string;
  select: (state: UiState) => boolean;
  toggle: () => void;
  disabled?: (state: UiState) => boolean;
};

export const SETTINGS_TOGGLES: HudToggleDefinition[] = [
  {
    id: 'postprocessing',
    label: 'Postprocessing',
    description: 'Selective bloom & FXAA',
    select: (state) => state.postprocessingEnabled,
    toggle: () => {
      useUiStore.getState().togglePostprocessing();
    },
  },
  {
    id: 'hud-bars',
    label: 'HUD Bars',
    description: 'Per-ship health overlays',
    select: (state) => state.hudHealthBarsEnabled,
    toggle: () => {
      const store = useUiStore.getState();
      store.toggleHudHealthBars();
    },
  },
  {
    id: 'progression-panel',
    label: 'Progression Panel',
    description: 'Ship XP, levels, and event tracking',
    select: (state) => state.progressionPanelEnabled,
    toggle: () => {
      useUiStore.getState().toggleProgressionPanel();
    },
  },
  {
    id: 'ai-v2',
    label: 'AI V2',
    description: 'Utility-based decision system',
    select: (state) => state.aiV2Enabled,
    toggle: () => {
      useUiStore.getState().toggleAiV2();
    },
  },
];

export const DEBUG_TOGGLES: HudToggleDefinition[] = [
  {
    id: 'ai-debug',
    label: 'AI Debug',
    description: 'Overlay for AI ticks & decisions',
    select: (state) => state.aiDebugEnabled,
    toggle: () => {
      useUiStore.getState().toggleAiDebug();
    },
    disabled: (state) => !state.aiV2Enabled,
  },
  {
    id: 'explosion-debug',
    label: 'Explosion Debug',
    description: 'Visualize explosion timing + payloads',
    select: (state) => state.explosionDebugEnabled,
    toggle: () => {
      useUiStore.getState().toggleExplosionDebug();
    },
  },
  {
    id: 'perf-monitor',
    label: 'Perf Monitor',
    description: 'Display draggable r3f-perf metrics overlay',
    select: (state) => state.perfMonitorEnabled,
    toggle: () => {
      useUiStore.getState().togglePerfMonitor();
    },
  },
  {
    id: 'ai-vertical',
    label: 'AI Vertical',
    description: 'Enable 3D vertical maneuvering',
    select: (state) => state.aiVerticalEnabled ?? AI_CONFIG.verticalEnabled,
    toggle: () => {
      useUiStore.getState().toggleAiVertical();
    },
  },
  {
    id: 'ai-engagement-boost',
    label: 'AI Engagement Boost',
    description: 'Enable engagement boost during opening salvo',
    select: (state) => state.aiEngagementBoostEnabled ?? AI_CONFIG.engagementBoostEnabled,
    toggle: () => {
      useUiStore.getState().toggleAiEngagementBoost();
    },
  },
  {
    id: 'ai-tick-experiment',
    label: 'AI Tick Rate Experiment',
    description: 'Enable experimental 15Hz tick rate',
    select: (state) => state.aiTickRateExperimentEnabled ?? AI_CONFIG.tickRateHzExperiment,
    toggle: () => {
      useUiStore.getState().toggleAiTickRateExperiment();
    },
  },
];
