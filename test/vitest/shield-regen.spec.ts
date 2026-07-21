import { describe, it, expect } from 'vite-plus/test';
import { Vector3, Quaternion } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { ShipEntity } from '../../src/types/index.js';
import { updateGame } from '../../src/game/systems.js';
import { createMockGameState } from '../fixtures/gameStateFactory.js';

function makeRigidBodyStub(init?: {
  pos?: { x: number; y: number; z: number };
  rot?: { x: number; y: number; z: number; w: number };
}) {
  let pos = init?.pos ?? { x: 0, y: 0, z: 0 };
  let rot = init?.rot ?? { x: 0, y: 0, z: 0, w: 1 };
  return {
    translation() {
      return pos;
    },
    rotation() {
      return rot;
    },
    setNextKinematicTranslation(p: { x: number; y: number; z: number }) {
      pos = { ...p };
    },
    setNextKinematicRotation(r: { x: number; y: number; z: number; w: number }) {
      rot = { ...r };
    },
    isValid() {
      return true;
    },
  } as any;
}

function makeShip(
  id: number,
  team: 'blue' | 'red',
  position: Vector3,
  hp = 10,
  shield = 10,
  maxShield = 20,
  regen = 0,
): ShipEntity {
  const rb = makeRigidBodyStub({ pos: { x: position.x, y: position.y, z: position.z } });
  const shipEntity = {
    id,
    rigidBody: rb as any,
    collider: { handle: 1000 + id, isValid: () => true } as any,
    transform: { position: position.clone(), rotation: new Quaternion(), scale: 1 },
    ship: {
      team,
      hull: 'fighter' as any,
      hp,
      maxHp: hp,
      shield,
      maxShield,
      shieldRegen: regen,
      cooldown: 999, // prevent auto-firing during these tests
      fireRate: 1,
      damage: 1,
      projectileSpeed: 10,
      range: 10,
      speed: 0,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter' as any,
    shieldRipples: [],
  } as unknown as ShipEntity;

  applyProgressionDefaults(shipEntity.ship, { maxHpOverride: shipEntity.ship.maxHp });
  return shipEntity;
}

describe('shield regeneration', () => {
  it('regenerates shield over time according to shieldRegen (hp/sec)', () => {
    const state = createMockGameState();
    const s = makeShip(1, 'blue', new Vector3(0, 0, 0), 10, 10, 20, 2); // regen 2 hp/s
    state.world.add(s);
    state.shipById.set(s.id, s);

    // Advance 1.5 seconds -> expect +3 hp
    updateGame(state, 1.5);
    expect(s.ship.shield).toBeCloseTo(13, 6);
  });

  it('does not exceed maxShield (clamps)', () => {
    const state = createMockGameState();
    // start at 19/20 with regen 5 hp/s, advance 1s -> would reach 24 but should clamp to 20
    const s = makeShip(2, 'red', new Vector3(0, 0, 0), 10, 19, 20, 5);
    state.world.add(s);
    state.shipById.set(s.id, s);

    updateGame(state, 1.0);
    expect(s.ship.shield).toBe(20);
  });
});
