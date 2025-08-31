import type { GameState, Ship, Bullet } from '../types/index.js';

export function applyBoundaryPhysicsShip(ship: Ship, state: GameState) {
  const bounds = state.simConfig.simBounds;
  const behavior = state.simConfig.boundaryBehavior.ships;

  if (behavior === 'bounce') {
    if (ship.pos.x < 0) { ship.pos.x = 0; ship.vel.x = -ship.vel.x; }
    else if (ship.pos.x > bounds.width) { ship.pos.x = bounds.width; ship.vel.x = -ship.vel.x; }
    if (ship.pos.y < 0) { ship.pos.y = 0; ship.vel.y = -ship.vel.y; }
    else if (ship.pos.y > bounds.height) { ship.pos.y = bounds.height; ship.vel.y = -ship.vel.y; }
    if (ship.pos.z < 0) { ship.pos.z = 0; ship.vel.z = -ship.vel.z; }
    else if (ship.pos.z > bounds.depth) { ship.pos.z = bounds.depth; ship.vel.z = -ship.vel.z; }
  } else if (behavior === 'wrap') {
    if (ship.pos.x < 0) ship.pos.x += bounds.width;
    else if (ship.pos.x > bounds.width) ship.pos.x -= bounds.width;
    if (ship.pos.y < 0) ship.pos.y += bounds.height;
    else if (ship.pos.y > bounds.height) ship.pos.y -= bounds.height;
    if (ship.pos.z < 0) ship.pos.z += bounds.depth;
    else if (ship.pos.z > bounds.depth) ship.pos.z -= bounds.depth;
  } else if (behavior === 'remove') {
    if (ship.pos.x < 0 || ship.pos.x > bounds.width ||
        ship.pos.y < 0 || ship.pos.y > bounds.height ||
        ship.pos.z < 0 || ship.pos.z > bounds.depth) {
      ship.health = 0;
    }
  }
}

export function applyBoundaryPhysicsBullet(b: Bullet, state: GameState) {
  const { width, height, depth } = state.simConfig.simBounds;
  const behavior = state.simConfig.boundaryBehavior.bullets;

  if (behavior === 'bounce') {
    if (b.pos.x < 0) { b.pos.x = 0; b.vel.x = -b.vel.x; }
    else if (b.pos.x > width) { b.pos.x = width; b.vel.x = -b.vel.x; }
    if (b.pos.y < 0) { b.pos.y = 0; b.vel.y = -b.vel.y; }
    else if (b.pos.y > height) { b.pos.y = height; b.vel.y = -b.vel.y; }
    if (b.pos.z < 0) { b.pos.z = 0; b.vel.z = -b.vel.z; }
    else if (b.pos.z > depth) { b.pos.z = depth; b.vel.z = -b.vel.z; }
  } else if (behavior === 'wrap') {
    if (b.pos.x < 0) b.pos.x += width;
    else if (b.pos.x > width) b.pos.x -= width;
    if (b.pos.y < 0) b.pos.y += height;
    else if (b.pos.y > height) b.pos.y -= height;
    if (b.pos.z < 0) b.pos.z += depth;
    else if (b.pos.z > depth) b.pos.z -= depth;
  } else if (behavior === 'remove') {
    if (b.pos.x < 0 || b.pos.x > width ||
        b.pos.y < 0 || b.pos.y > height ||
        b.pos.z < 0 || b.pos.z > depth) {
      b.ttl = 0;
    }
  }
}
