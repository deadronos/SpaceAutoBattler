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
  // Opacity controls (0.0 - 1.0) to allow tuning HUD transparency without changing colors
  overlayOpacity: number;
  barBgOpacity: number;
  fillOpacity: number;
  statusBadgeOpacity: number;
  // Offset (in pixels) applied to the HUD position relative to the ship's reported screen coordinates
  // Positive x shifts right; positive y shifts down. Use negative y to raise the HUD above the ship.
  hudOffsetX: number;
  hudOffsetY: number;
}

export interface StatusEffectDefinition {
  icon: string;
  label: string;
  tone: 'info' | 'warning' | 'critical';
}

/**
 * Configuration for the HUD health bars and overlays.
 */
export const DEFAULT_HUD_HEALTH_OVERLAY_CONFIG: HudHealthOverlayConfig = {
  shieldColor: '#4cc2ff',
  healthColor: '#3bd675',
  barWidth: 40,
  barHeight: 6,
  gap: 4,
  animationDurationMs: 150,
  statusBadgeSize: 16,
  statusBadgeGap: 12,
  // Default opacities matched from existing stylesheet values
  overlayOpacity: 0.56,
  barBgOpacity: 0.6,
  fillOpacity: 0.6,
  statusBadgeOpacity: 0.65,
  // Default to no offset; consumers can change these to nudge the HUD relative to the ship
  hudOffsetX: 0,
  hudOffsetY: 50,
};

/**
 * Registry of status effect definitions (icons, labels, tones).
 */
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

/**
 * Fallback definition for unknown status effects.
 */
export const STATUS_EFFECT_FALLBACK: StatusEffectDefinition = {
  icon: '❔',
  label: 'Unknown effect',
  tone: 'info',
};
