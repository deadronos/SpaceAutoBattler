import { create } from 'zustand';
import type { ShipHull, StatusEffectTag, Team } from '../types/index.js';

export interface ShipHudOverlaySnapshot {
  id: number;
  team: Team;
  hull: ShipHull;
  /** Screen-space X coordinate in pixels. */
  x: number;
  /** Screen-space Y coordinate in pixels. */
  y: number;
  /** Whether the ship is within the view frustum. */
  visible: boolean;
  /** Ratio 0..1 describing current hull integrity. */
  healthRatio: number;
  /** Ratio 0..1 describing current shield capacity, NaN when ship has no shields. */
  shieldRatio: number;
  /** Optional list of status effects to display. */
  statusEffects: StatusEffectTag[];
  /** Stable seed used for deterministic easing. */
  seed: number;
  /** World-space coordinates for potential future overlays. */
  worldPosition: { x: number; y: number; z: number };
}

export interface HudOverlayViewport {
  width: number;
  height: number;
}

interface HudOverlayStore {
  frame: number;
  overlays: ShipHudOverlaySnapshot[];
  viewport: HudOverlayViewport;
  setSnapshot: (
    frame: number,
    overlays: ShipHudOverlaySnapshot[],
    viewport: HudOverlayViewport,
  ) => void;
  clear: () => void;
}

export const useHudOverlayStore = create<HudOverlayStore>((set, get) => ({
  frame: 0,
  overlays: [],
  viewport: { width: 1, height: 1 },
  setSnapshot: (frame, overlays, viewport) => set({ frame, overlays, viewport }),
  clear: () => {
    const current = get();
    if (current.overlays.length === 0) return;
    set({ overlays: [], frame: current.frame + 1 });
  },
}));
