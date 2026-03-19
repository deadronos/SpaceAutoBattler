import { useLayoutEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useUiStore } from '../game/uiStore.js';
import {
  DEFAULT_HUD_HEALTH_OVERLAY_CONFIG,
  STATUS_EFFECT_FALLBACK,
  STATUS_EFFECT_REGISTRY,
  type HudHealthOverlayConfig,
  type StatusEffectDefinition,
} from '../config/hudHealth.js';
import { useHudOverlayStore, type ShipHudOverlaySnapshot } from '../renderer/hudOverlayStore.js';
import type { StatusEffectTag } from '../types/index.js';
import { ShipHudOverlay } from './ShipHudOverlay.js';

export interface OverlayLayoutResult {
  id: number;
  team: ShipHudOverlaySnapshot['team'];
  hull: ShipHudOverlaySnapshot['hull'];
  ratios: { health: number; shield: number };
  screen: { x: number; y: number; hidden: boolean };
  seed: number;
  effects: StatusEffectViewModel[];
  overflowCount: number;
}

export interface StatusEffectViewModel {
  tag: StatusEffectTag;
  definition: StatusEffectDefinition;
}

interface LayoutContext {
  viewport: { width: number; height: number };
  reserved: ReservedRect[];
  config: HudHealthOverlayConfig;
}

interface ReservedRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

type RectLike = ReservedRect;

const EDGE_MARGIN = 16;
const MAX_BADGES = 2;

export function HudHealthLayer(): React.ReactElement | null {
  const enabled = useUiStore((s) => s.hudHealthBarsEnabled);
  const overlays = useHudOverlayStore((s) => s.overlays);
  const viewport = useHudOverlayStore((s) => s.viewport);
  const reservedRects = useReservedRects();

  const layout = useMemo(() => {
    if (!enabled) return [];
    return layoutOverlays(overlays, {
      viewport,
      reserved: reservedRects,
      config: DEFAULT_HUD_HEALTH_OVERLAY_CONFIG,
    });
  }, [enabled, overlays, reservedRects, viewport]);

  if (!enabled) return null;

  if (!layout.length) {
    return <div className="hud-health-layer" aria-live="polite" aria-label="HUD health overlays" />;
  }

  return (
    <div className="hud-health-layer" aria-live="polite" aria-label="HUD health overlays">
      {layout.map((overlay) => (
        <ShipHudOverlay
          key={overlay.id}
          overlay={overlay}
          config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG}
        />
      ))}
    </div>
  );
}

function useReservedRects(): ReservedRect[] {
  const [rects, setRects] = useState<ReservedRect[]>([]);
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const selectors = ['.controls-bar', '.hud-panel'];
    const measure = () => {
      const next: ReservedRect[] = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        next.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        });
      }
      setRects(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);
  return rects;
}

export function layoutOverlays(
  overlays: ShipHudOverlaySnapshot[],
  ctx: LayoutContext,
): OverlayLayoutResult[] {
  return overlays.map((overlay) => {
    const screen = placeOverlay(overlay, ctx);
    const limitedEffects = overlay.statusEffects.slice(0, MAX_BADGES);
    const overflowCount = Math.max(overlay.statusEffects.length - limitedEffects.length, 0);
    const effectViewModels: StatusEffectViewModel[] = limitedEffects.map((tag) => ({
      tag,
      definition: STATUS_EFFECT_REGISTRY[tag] ?? STATUS_EFFECT_FALLBACK,
    }));
    return {
      id: overlay.id,
      team: overlay.team,
      hull: overlay.hull,
      ratios: {
        health: overlay.healthRatio,
        shield: overlay.shieldRatio,
      },
      screen,
      seed: overlay.seed,
      effects: effectViewModels,
      overflowCount,
    };
  });
}

function placeOverlay(
  overlay: ShipHudOverlaySnapshot,
  ctx: LayoutContext,
): { x: number; y: number; hidden: boolean } {
  if (!overlay.visible) {
    // Even when hidden, return coordinates adjusted by the configured HUD offset so callers
    // see consistent screen positions for overlays.
    return {
      x: overlay.x + ctx.config.hudOffsetX,
      y: overlay.y + ctx.config.hudOffsetY,
      hidden: true,
    };
  }
  const { viewport, reserved, config } = ctx;
  // Apply configured HUD offset (in pixels) to the overlay's reported screen coordinates.
  // Positive x moves the HUD right; positive y moves it down.
  let x = overlay.x + config.hudOffsetX;
  let y = overlay.y + config.hudOffsetY;
  const dims = overlayDimensions(overlay, config);
  let box = buildBox(x, y, dims);

  if (box.left < EDGE_MARGIN) {
    x += EDGE_MARGIN - box.left;
    box = buildBox(x, y, dims);
  }
  if (box.right > viewport.width - EDGE_MARGIN) {
    x -= box.right - (viewport.width - EDGE_MARGIN);
    box = buildBox(x, y, dims);
  }
  if (box.top < EDGE_MARGIN) {
    y += EDGE_MARGIN - box.top;
    box = buildBox(x, y, dims);
  }

  for (const rect of reserved) {
    if (intersects(box, rect)) {
      y = rect.bottom + EDGE_MARGIN;
      box = buildBox(x, y, dims);
    }
  }

  if (box.bottom > viewport.height - EDGE_MARGIN) {
    return { x, y, hidden: true };
  }

  return { x, y, hidden: false };
}

function overlayDimensions(
  overlay: ShipHudOverlaySnapshot,
  config: HudHealthOverlayConfig,
): { width: number; height: number } {
  const badgeCount = Math.min(MAX_BADGES, overlay.statusEffects.length);
  const overflow = overlay.statusEffects.length > badgeCount ? 1 : 0;
  const statusWidth =
    badgeCount + overflow > 0
      ? config.statusBadgeGap + (badgeCount + overflow) * config.statusBadgeSize
      : 0;
  // Include horizontal padding from the overlay (12px left + 12px right) so the placement math
  // matches the actual rendered box width the user sees on screen.
  const horizontalPadding = 12 + 12;
  const width = config.barWidth + statusWidth + horizontalPadding;
  // Include vertical padding (8px top + 8px bottom) so height matches the rendered box.
  const verticalPadding = 8 + 8;
  const height = config.barHeight * 2 + config.gap + verticalPadding;
  return { width, height };
}

function buildBox(x: number, y: number, dims: { width: number; height: number }): RectLike {
  const left = x - dims.width / 2;
  const right = x + dims.width / 2;
  const top = y - dims.height;
  const bottom = y;
  return { left, right, top, bottom, width: dims.width, height: dims.height };
}

function intersects(a: RectLike, b: RectLike): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
