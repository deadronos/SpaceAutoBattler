import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useUiStore } from '../app/uiStore.js';
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
const RESERVED_PANEL_SELECTORS = [
  '.controls-bar',
  '.hud-panel',
  '.ai-debug-overlay',
  '.progression-panel',
  '.explosion-debug-overlay',
  '.hud-perf-monitor',
] as const;

export function HudHealthLayer(): React.ReactElement | null {
  const enabled = useUiStore((s) => s.hudHealthBarsEnabled);
  const overlays = useHudOverlayStore((s) => s.overlays);
  const viewport = useHudOverlayStore((s) => s.viewport);
  const reservedRects = useReservedRects(enabled);

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
    return <div className="hud-health-layer" aria-label="HUD health overlays" />;
  }

  return (
    <div className="hud-health-layer" aria-label="HUD health overlays">
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

function rectsEqual(a: readonly ReservedRect[], b: readonly ReservedRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const prev = a[i]!;
    const next = b[i]!;
    if (
      prev.left !== next.left ||
      prev.right !== next.right ||
      prev.top !== next.top ||
      prev.bottom !== next.bottom ||
      prev.width !== next.width ||
      prev.height !== next.height
    ) {
      return false;
    }
  }
  return true;
}

function useReservedRects(enabled: boolean): ReservedRect[] {
  const [rects, setRects] = useState<ReservedRect[]>([]);
  const aiDebugEnabled = useUiStore((s) => s.aiDebugEnabled);
  const explosionDebugEnabled = useUiStore((s) => s.explosionDebugEnabled);
  const perfMonitorEnabled = useUiStore((s) => s.perfMonitorEnabled);
  const perfMonitorPosition = useUiStore((s) => s.perfMonitorPosition);
  const progressionPanelEnabled = useUiStore((s) => s.progressionPanelEnabled);
  const progressionPanelPosition = useUiStore((s) => s.progressionPanelPosition);
  const syncAndMeasureRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      syncAndMeasureRef.current = null;
      return;
    }

    const observed = new Set<Element>();

    const collectElements = (): Element[] => {
      const elements: Element[] = [];
      for (const selector of RESERVED_PANEL_SELECTORS) {
        const matches = document.querySelectorAll(selector);
        for (const el of matches) {
          elements.push(el);
        }
      }
      return elements;
    };

    const measure = () => {
      const next: ReservedRect[] = [];
      for (const el of collectElements()) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) continue;
        next.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        });
      }
      setRects((prev) => (rectsEqual(prev, next) ? prev : next));
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;

    const syncObserved = (): boolean => {
      const current = new Set(collectElements());
      let changed = false;

      for (const el of observed) {
        if (!current.has(el)) {
          resizeObserver?.unobserve(el);
          observed.delete(el);
          changed = true;
        }
      }

      for (const el of current) {
        if (!observed.has(el)) {
          resizeObserver?.observe(el);
          observed.add(el);
          changed = true;
        }
      }

      return changed;
    };

    const syncAndMeasure = () => {
      syncObserved();
      measure();
    };

    syncAndMeasureRef.current = syncAndMeasure;
    syncAndMeasure();

    // Re-sync ResizeObserver targets when overlay panels mount or unmount dynamically.
    const mutationObserver =
      typeof MutationObserver !== 'undefined' && document.body
        ? new MutationObserver(() => {
            if (syncObserved()) {
              measure();
            }
          })
        : null;
    mutationObserver?.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', measure);
    return () => {
      syncAndMeasureRef.current = null;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      observed.clear();
      window.removeEventListener('resize', measure);
    };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;
    syncAndMeasureRef.current?.();
  }, [
    enabled,
    aiDebugEnabled,
    explosionDebugEnabled,
    perfMonitorEnabled,
    perfMonitorPosition,
    progressionPanelEnabled,
    progressionPanelPosition,
  ]);

  return enabled ? rects : [];
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
