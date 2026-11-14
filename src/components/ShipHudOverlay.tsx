import { memo, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { HudHealthOverlayConfig } from '../config/hudHealth.js';
import { lerpBySeed } from '../utils/deterministicLerp.js';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';
import { clampRatio } from '../utils/math.js';
import type { OverlayLayoutResult, StatusEffectViewModel } from './HudHealthLayer.js';

interface ShipHudOverlayProps {
  overlay: OverlayLayoutResult;
  config: HudHealthOverlayConfig;
}

const CONVERGENCE_EPSILON = 0.002;

function useSmoothedRatio(target: number, seed: number, reducedMotion: boolean): number {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (reducedMotion || typeof requestAnimationFrame !== 'function') {
      return;
    }
    if (Math.abs(display - target) <= CONVERGENCE_EPSILON) {
      return;
    }
    const rafId = requestAnimationFrame(() => {
      setDisplay((current) => {
        const next = lerpBySeed(seed, current, target);
        return Math.abs(next - target) <= CONVERGENCE_EPSILON ? target : next;
      });
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [display, target, seed, reducedMotion]);

  if (reducedMotion || Math.abs(display - target) <= CONVERGENCE_EPSILON) {
    return target;
  }
  return display;
}

export const ShipHudOverlay = memo(ShipHudOverlayView, haveEqualOverlayProps);

function ShipHudOverlayView({ overlay, config }: ShipHudOverlayProps): React.ReactElement | null {
  const reducedMotion = usePrefersReducedMotion();
  const hasShield = Number.isFinite(overlay.ratios.shield);
  const targetHealth = clampRatio(overlay.ratios.health);
  const targetShield = hasShield ? clampRatio(overlay.ratios.shield) : 0;
  const effectiveHealth = useSmoothedRatio(targetHealth, overlay.seed, reducedMotion);
  const smoothedShield = useSmoothedRatio(targetShield, overlay.seed ^ 0x517cc1b7, reducedMotion);
  const effectiveShield = hasShield ? smoothedShield : 0;

  const effects = overlay.effects;
  const containerStyle = useMemo(
    () => ({
      left: `${overlay.screen.x}px`,
      top: `${overlay.screen.y}px`,
      // Expose the configured bar width to the stylesheet so the outer bar element can size correctly
      ['--hud-bar-width']: `${config.barWidth}px`,
      // Opacity tunables for HUD visuals
      ['--hud-overlay-opacity']: String(config.overlayOpacity),
      ['--hud-bar-bg-opacity']: String(config.barBgOpacity),
      ['--hud-fill-opacity']: String(config.fillOpacity),
      ['--hud-badge-opacity']: String(config.statusBadgeOpacity),
    }),
    [
      overlay.screen.x,
      overlay.screen.y,
      config.barWidth,
      config.overlayOpacity,
      config.barBgOpacity,
      config.fillOpacity,
      config.statusBadgeOpacity,
    ],
  );

  if (overlay.screen.hidden) {
    return null;
  }

  const healthPercent = Math.round(effectiveHealth * 100);
  const shieldPercent = Math.round(effectiveShield * 100);

  return (
    <div
      className={`ship-hud-overlay ship-hud-overlay--${overlay.team}`}
      // Cast to React.CSSProperties so custom properties are accepted by TypeScript
      style={containerStyle as React.CSSProperties}
      role="group"
      aria-label={`${overlay.hull} hull ${healthPercent}% integrity${hasShield ? `, shields ${shieldPercent}%` : ''}`}
    >
      <div className="ship-hud-overlay__content">
        <div className="ship-hud-overlay__bars">
          <div
            className={`ship-hud-overlay__bar ship-hud-overlay__bar--shield${hasShield ? '' : ' ship-hud-overlay__bar--disabled'}`}
          >
            <div
              className="ship-hud-overlay__fill"
              style={{
                width: `${Math.round(effectiveShield * config.barWidth)}px`,
                backgroundColor: config.shieldColor,
              }}
            />
          </div>
          <div className="ship-hud-overlay__bar ship-hud-overlay__bar--health">
            <div
              className="ship-hud-overlay__fill"
              style={{
                width: `${Math.round(effectiveHealth * config.barWidth)}px`,
                backgroundColor: config.healthColor,
              }}
            />
          </div>
        </div>
        <StatusEffectStrip effects={effects} overflowCount={overlay.overflowCount} />
      </div>
    </div>
  );
}

function haveEqualOverlayProps(previous: ShipHudOverlayProps, next: ShipHudOverlayProps): boolean {
  if (previous.config !== next.config) return false;
  const a = previous.overlay;
  const b = next.overlay;
  return (
    a.team === b.team &&
    a.hull === b.hull &&
    a.seed === b.seed &&
    a.screen.hidden === b.screen.hidden &&
    a.screen.x === b.screen.x &&
    a.screen.y === b.screen.y &&
    a.ratios.health === b.ratios.health &&
    Object.is(a.ratios.shield, b.ratios.shield) &&
    a.overflowCount === b.overflowCount &&
    a.effects.length === b.effects.length &&
    a.effects.every((effect, index) => {
      const nextEffect = b.effects[index];
      return effect.tag === nextEffect?.tag && effect.definition === nextEffect.definition;
    })
  );
}

function StatusEffectStrip({
  effects,
  overflowCount,
}: {
  effects: StatusEffectViewModel[];
  overflowCount: number;
}): React.ReactElement {
  if (effects.length === 0 && overflowCount === 0) {
    return <div className="ship-hud-overlay__badges" aria-hidden />;
  }
  return (
    <div className="ship-hud-overlay__badges" role="list">
      {effects.map((effect) => (
        <div key={effect.tag} role="listitem">
          <StatusEffectBadge effect={effect} />
        </div>
      ))}
      {overflowCount > 0 ? (
        <div role="listitem">
          <StatusOverflowBadge count={overflowCount} />
        </div>
      ) : null}
    </div>
  );
}

function StatusEffectBadge({ effect }: { effect: StatusEffectViewModel }): React.ReactElement {
  const tone = effect.definition.tone;
  return (
    <span
      className={`ship-hud-overlay__badge ship-hud-overlay__badge--${tone}`}
      role="img"
      aria-label={effect.definition.label}
      title={effect.definition.label}
    >
      {effect.definition.icon}
    </span>
  );
}

function StatusOverflowBadge({ count }: { count: number }): React.ReactElement {
  return (
    <span
      className="ship-hud-overlay__badge ship-hud-overlay__badge--info ship-hud-overlay__badge--overflow"
      title={`+${count} additional status effects`}
      aria-label={`Plus ${count} additional status effects`}
      role="img"
    >
      +{count}
    </span>
  );
}
