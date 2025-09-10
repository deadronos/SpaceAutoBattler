import type { GameState, Ship, Vector3 } from '../../types/index.js';
import type { FormationConfig } from '../../config/behaviorConfig.js';
import { getFormationConfig } from '../../config/behaviorConfig.js';
import { DEBUG_AI } from '../../utils/env';
import { findNearbyFriends } from './spatial.js';

export function findBestFormation(
  state: GameState,
  ship: Ship,
): { name: string; config: FormationConfig } | null {
  const cfg = state.behaviorConfig!;
  const searchRadius = cfg.globalSettings.formationSearchRadius;
  if (ship.class !== 'carrier') {
    for (const s of state.ships) {
      if (s.team === ship.team && s.class === 'carrier' && s.health > 0) {
        const d = distance(ship.pos, s.pos);
        if (d <= searchRadius) {
          const f = getFormationConfig(cfg, 'escort');
          if (DEBUG_AI) {
            try {
              console.error(
                `AI-DEBUG findBestFormation ship=${ship.id} found escort near carrier id=${s.id} dist=${d.toFixed(2)}`,
              );
            } catch {
              void 0;
            }
          }
          if (f) return { name: 'escort', config: f };
        }
      }
    }
  }
  const nearby = findNearbyFriends(state, ship, searchRadius);
  if (nearby.length >= cfg.globalSettings.formationMinGroupSize) {
    const f = getFormationConfig(cfg, 'line') || Object.values(cfg.formations)[0];
    if (DEBUG_AI) {
      try {
        console.error(
          `AI-DEBUG findBestFormation ship=${ship.id} nearby=${nearby.length} returning formation=${f?.type}`,
        );
      } catch {
        void 0;
      }
    }
    if (f) return { name: 'line', config: f };
  }
  return null;
}

export function getFormationCenter(
  state: GameState,
  ship: Ship,
  _formationName: string,
): Vector3 | null {
  const friends = findNearbyFriends(
    state,
    ship,
    state.behaviorConfig!.globalSettings.formationSearchRadius,
  );
  if (friends.length === 0) return null;
  let cx = 0,
    cy = 0,
    cz = 0;
  for (const f of friends) {
    cx += f.pos.x;
    cy += f.pos.y;
    cz += f.pos.z;
  }
  const inv = 1 / friends.length;
  return { x: cx * inv, y: cy * inv, z: cz * inv };
}

export function assignFormationSlot(
  state: GameState,
  ship: Ship,
  _formationName: string,
  formationConfig: FormationConfig,
  center: Vector3,
): void {
  const slotCount = formationConfig.maxSize;
  const spacing = formationConfig.spacing;
  // Ensure aiState exists and record formation id
  ship.aiState =
    ship.aiState ??
    ({ currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as Ship['aiState']);
  ship.aiState!.formationId = _formationName;
  // Choose a unique slot index not already taken by other ships in the same formation
  const used = new Set<number>();
  for (const s of state.ships) {
    if (
      s.aiState &&
      s.aiState.formationId === _formationName &&
      typeof s.aiState.formationSlotIndex === 'number'
    )
      used.add(s.aiState.formationSlotIndex);
  }
  let slotIndex = 0;
  for (let i = 0; i < slotCount; i++) {
    if (!used.has(i)) {
      slotIndex = i;
      break;
    }
  }
  ship.aiState!.formationSlotIndex = slotIndex;
  let slotOffset: Vector3 = { x: 0, y: 0, z: 0 };
  if (formationConfig.type === 'line') {
    slotOffset = { x: (slotIndex - Math.floor(slotCount / 2)) * spacing, y: 0, z: 0 };
  } else if (formationConfig.type === 'circle') {
    const angle = (2 * Math.PI * slotIndex) / slotCount;
    slotOffset = { x: Math.cos(angle) * spacing, y: Math.sin(angle) * spacing, z: 0 };
  } else {
    slotOffset = { x: (slotIndex - Math.floor(slotCount / 2)) * spacing, y: 0, z: 0 };
  }
  ship.aiState!.formationPosition = {
    x: center.x + slotOffset.x,
    y: center.y + slotOffset.y,
    z: center.z + slotOffset.z,
  };
  if (DEBUG_AI) {
    try {
      console.error(
        `AI-DEBUG assignFormationSlot ship=${ship.id} formation=${formationConfig.type} slot=${slotIndex} pos=${ship.aiState!.formationPosition.x.toFixed(2)},${ship.aiState!.formationPosition.y.toFixed(2)},${ship.aiState!.formationPosition.z.toFixed(2)}`,
      );
    } catch {
      void 0;
    }
  }
}

export function clearFormationSlot(_state: GameState, ship: Ship): void {
  if (!ship.aiState) return;
  ship.aiState.formationId = undefined;
  ship.aiState.formationPosition = undefined;
  ship.aiState.formationSlotIndex = undefined;
}

function distance(a: Vector3, b: Vector3) {
  const dx = a.x - b.x,
    dy = a.y - b.y,
    dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
