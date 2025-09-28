import { useUiStore, type UiState } from '../game/uiStore.js';

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
];
