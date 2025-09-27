import type { StatusEffectTag } from '../types/index.js';

export interface HudHealthOverlayConfig {
  shieldColor: string;
  healthColor: string;
  barWidth: number;
  barHeight: number;
  gap: number;
  animationDurationMs: number;
  statusBadgeSize: number;
  statusBadgeGap: number;
}

export interface StatusEffectDefinition {
  icon: string;
  label: string;
  tone: 'info' | 'warning' | 'critical';
}

export const DEFAULT_HUD_HEALTH_OVERLAY_CONFIG: HudHealthOverlayConfig = {
  shieldColor: '#4cc2ff',
  healthColor: '#3bd675',
  barWidth: 80,
  barHeight: 6,
  gap: 4,
  animationDurationMs: 150,
  statusBadgeSize: 16,
  statusBadgeGap: 12,
};

export const STATUS_EFFECT_REGISTRY: Record<StatusEffectTag, StatusEffectDefinition> = {
  jammed: {
    icon: '📡',
    label: 'Targeting jammed',
    tone: 'warning',
  },
  'shield-down': {
    icon: '🛡️',
    label: 'Shields offline',
    tone: 'critical',
  },
  'engine-disrupted': {
    icon: '⚙️',
    label: 'Engines disrupted',
    tone: 'warning',
  },
  hacked: {
    icon: '🛰️',
    label: 'Systems hacked',
    tone: 'critical',
  },
};

export const STATUS_EFFECT_FALLBACK: StatusEffectDefinition = {
  icon: '❔',
  label: 'Unknown effect',
  tone: 'info',
};
