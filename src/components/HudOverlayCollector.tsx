import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ShipEntity, StatusEffectTag } from '../types/index.js';
import { useGameState } from '../app/context.js';
import { useUiStore } from '../app/uiStore.js';
import { clamp01 } from '../utils/math.js';
import { TEMP_HUD_POSITION } from '../utils/tempVectors.js';
import { useHudOverlayStore, type ShipHudOverlaySnapshot } from '../renderer/hudOverlayStore.js';

const HUD_UPDATE_INTERVAL = 1 / 30;

export function HudOverlayCollector(): null {
  const state = useGameState();
  const lastSnapshotTime = useRef(-Infinity);
  const hudEnabledRef = useRef(useUiStore.getState().hudHealthBarsEnabled);

  useEffect(() => {
    const unsubscribe = useUiStore.subscribe((state) => {
      const enabled = state.hudHealthBarsEnabled;
      hudEnabledRef.current = enabled;
      if (!enabled) {
        lastSnapshotTime.current = -Infinity;
        useHudOverlayStore.getState().clear();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      useHudOverlayStore.getState().clear();
    };
  }, []);

  useFrame(({ camera, size, clock }) => {
    if (!hudEnabledRef.current) return;
    const now = clock.elapsedTime;
    if (now - lastSnapshotTime.current < HUD_UPDATE_INTERVAL) return;
    lastSnapshotTime.current = now;

    const overlays: ShipHudOverlaySnapshot[] = [];
    const ships = state.queries.ships.entities as ShipEntity[];

    for (const ship of ships) {
      const transform = ship.transform;
      if (!transform) continue;

      TEMP_HUD_POSITION.copy(transform.position);
      TEMP_HUD_POSITION.project(camera);
      const visible = TEMP_HUD_POSITION.z >= -1 && TEMP_HUD_POSITION.z <= 1;
      const x = (TEMP_HUD_POSITION.x * 0.5 + 0.5) * size.width;
      const y = (-TEMP_HUD_POSITION.y * 0.5 + 0.5) * size.height;
      const healthRatio = safeRatio(ship.ship.hp, ship.ship.maxHp);
      const shieldRatio =
        ship.ship.maxShield > 0 ? safeRatio(ship.ship.shield, ship.ship.maxShield) : Number.NaN;
      overlays.push({
        id: ship.id,
        team: ship.ship.team,
        hull: ship.ship.hull,
        x,
        y,
        visible,
        healthRatio,
        shieldRatio,
        statusEffects: resolveStatusEffects(ship, shieldRatio),
        seed: ship.id,
        worldPosition: {
          x: transform.position.x,
          y: transform.position.y,
          z: transform.position.z,
        },
      });
    }

    const overlayStore = useHudOverlayStore.getState();
    overlayStore.setSnapshot(overlayStore.frame + 1, overlays, {
      width: size.width,
      height: size.height,
    });
  });

  return null;
}

function safeRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return clamp01(value / max);
}

function resolveStatusEffects(ship: ShipEntity, shieldRatio: number): StatusEffectTag[] {
  const effects: StatusEffectTag[] = [];
  if (Array.isArray(ship.ship.effects)) {
    for (const effect of ship.ship.effects) {
      if (!effects.includes(effect)) effects.push(effect);
    }
  }
  if (shieldRatio === 0 && ship.ship.maxShield > 0 && !effects.includes('shield-down')) {
    effects.push('shield-down');
  }
  return effects;
}
