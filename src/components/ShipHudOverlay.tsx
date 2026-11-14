import { useMemo, useState } from 'react';
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

export function ShipHudOverlay({
  overlay,
  config,
}: ShipHudOverlayProps): React.ReactElement | null {
  const reducedMotion = usePrefersReducedMotion();
  const hasShield = Number.isFinite(overlay.ratios.shield);
  const targetHealth = clampRatio(overlay.ratios.health);
  const targetShield = hasShield ? clampRatio(overlay.ratios.shield) : 0;
  const [healthState, setHealthState] = useState(() => ({
    target: targetHealth,
    display: targetHealth,
  }));
  const [shieldState, setShieldState] = useState(() => ({
    target: targetShield,
    display: targetShield,
  }));

  let effectiveHealth = targetHealth;
  if (!reducedMotion) {
    if (healthState.target !== targetHealth) {
      const nextDisplay = lerpBySeed(overlay.seed, healthState.display, targetHealth);
      setHealthState({ target: targetHealth, display: nextDisplay });
      effectiveHealth = nextDisplay;
    } else {
      effectiveHealth = healthState.display;
    }
  }

  let effectiveShield = hasShield ? targetShield : 0;
  if (hasShield && !reducedMotion) {
    if (shieldState.target !== targetShield) {
      const nextDisplay = lerpBySeed(overlay.seed ^ 0x517cc1b7, shieldState.display, targetShield);
      setShieldState({ target: targetShield, display: nextDisplay });
      effectiveShield = nextDisplay;
    } else {
      effectiveShield = shieldState.display;
    }
  }

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
