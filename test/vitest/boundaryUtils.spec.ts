import { describe, it, expect } from 'vitest';
import { applyBoundaryPhysicsShip, applyBoundaryPhysicsBullet } from '../../src/core/boundaryUtils.js';

function makeShip(x: number, y: number, z = 0) {
  return {
    id: 1,
    team: 'red',
    pos: { x, y, z },
    vel: { x: 0, y: 0, z: 0 },
    health: 100
  } as any;
}

function makeBullet(x: number, y: number, z = 0) {
  return { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, ttl: 10 } as any;
}

function makeState(behaviorShips: 'bounce' | 'wrap' | 'remove', behaviorBullets: 'bounce' | 'wrap' | 'remove') {
  return {
    simConfig: {
      simBounds: { width: 100, height: 100, depth: 100 },
      boundaryBehavior: { ships: behaviorShips, bullets: behaviorBullets }
    }
  } as any;
}

describe('boundaryUtils', () => {
  it('bounce keeps ships inside and inverts velocity', () => {
    const s = makeShip(-10, 50, 0);
    s.vel.x = -5;
    const state = makeState('bounce', 'bounce');
    applyBoundaryPhysicsShip(s, state);
    expect(s.pos.x).toBe(0);
    expect(s.vel.x).toBe(5);
  });

  it('wrap wraps ships around', () => {
    const s = makeShip(110, 50, 0);
    const state = makeState('wrap', 'wrap');
    applyBoundaryPhysicsShip(s, state);
    expect(s.pos.x).toBeCloseTo(10);
  });

  it('remove sets health to 0 when out of bounds', () => {
    const s = makeShip(200, 200, 0);
    const state = makeState('remove', 'remove');
    applyBoundaryPhysicsShip(s, state);
    expect(s.health).toBe(0);
  });

  it('bullet bounce inverts velocity and clamps position', () => {
    const b = makeBullet(-5, 50, 0);
    b.vel.x = -20;
    const state = makeState('bounce', 'bounce');
    applyBoundaryPhysicsBullet(b, state);
    expect(b.pos.x).toBe(0);
    expect(b.vel.x).toBe(20);
  });

  it('bullet wrap wraps position', () => {
    const b = makeBullet(150, 50, 0);
    const state = makeState('wrap', 'wrap');
    applyBoundaryPhysicsBullet(b, state);
    expect(b.pos.x).toBeCloseTo(50);
  });

  it('bullet remove sets ttl to 0 when out of bounds', () => {
    const b = makeBullet(-100, 0, 0);
    const state = makeState('remove', 'remove');
    applyBoundaryPhysicsBullet(b, state);
    expect(b.ttl).toBe(0);
  });
});
