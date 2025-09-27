import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { ShipEntity, StatusEffectTag } from '../types/index.js';
import { useGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { useHudOverlayStore, type ShipHudOverlaySnapshot } from '../renderer/hudOverlayStore.js';

const tmpPosition = new Vector3();
let frameCounter = 0;

export function HudOverlayCollector(): null {
  const state = useGameState();
  const hudEnabledRef = useRef(useUiStore.getState().hudHealthBarsEnabled);

  useEffect(() => {
    const unsubscribe = useUiStore.subscribe((state) => {
      const enabled = state.hudHealthBarsEnabled;
      hudEnabledRef.current = enabled;
      if (!enabled) {
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

  useFrame(({ camera, size }) => {
    if (!hudEnabledRef.current) return;

    const overlays: ShipHudOverlaySnapshot[] = [];
    const ships = state.queries.ships.entities as ShipEntity[];

    for (const ship of ships) {
      const transform = ship.transform;
      if (!transform) continue;

      tmpPosition.copy(transform.position);
      tmpPosition.project(camera);
      const visible = tmpPosition.z >= -1 && tmpPosition.z <= 1;
      const x = (tmpPosition.x * 0.5 + 0.5) * size.width;
      const y = (-tmpPosition.y * 0.5 + 0.5) * size.height;
      const healthRatio = safeRatio(ship.ship.hp, ship.ship.maxHp);
      const shieldRatio = ship.ship.maxShield > 0 ? safeRatio(ship.ship.shield, ship.ship.maxShield) : Number.NaN;
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

    useHudOverlayStore
      .getState()
      .setSnapshot(++frameCounter, overlays, { width: size.width, height: size.height });
  });

  return null;
}

function safeRatio(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return Math.min(Math.max(value / max, 0), 1);
}

function resolveStatusEffects(ship: ShipEntity, shieldRatio: number): StatusEffectTag[] {
  const effects: StatusEffectTag[] = Array.isArray(ship.ship.effects) ? [...ship.ship.effects] : [];
  if (Number.isFinite(shieldRatio) && shieldRatio <= 0 && ship.ship.maxShield > 0) {
    effects.push('shield-down');
  }
  const seen = new Set<StatusEffectTag>();
  const deduped: StatusEffectTag[] = [];
  for (const effect of effects) {
    if (seen.has(effect)) continue;
    seen.add(effect);
    deduped.push(effect);
  }
  return deduped;
}
