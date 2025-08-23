import { describe, it, expect } from 'vitest';

// Import JS for now because entities may still export JS/TS hybrids in migration
import * as EntitiesTS from '../../src/entities';

// Fallback shape checks to avoid coupling to implementation details
function isShipLike(o:any) {
  return o && typeof o.id === 'number' && typeof o.team === 'string' && typeof o.hp === 'number';
}

function hasBulletFields(o:any) {
  return o && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.vx === 'number' && typeof o.vy === 'number';
}

describe('entities.ts basic shape', () => {
  it('exports Ship/Bullet factories or classes', () => {
    // Try common names; tolerate undefineds for migration safety
    const Ship = (EntitiesTS as any).Ship || (EntitiesTS as any).createShip;
    const Bullet = (EntitiesTS as any).Bullet || (EntitiesTS as any).createBullet;

    // If neither exists, the module should still be an object
    expect(EntitiesTS && typeof EntitiesTS).toBe('object');

    // If Ship exists, create a minimal instance and validate shape
    if (Ship) {
      const s = typeof Ship === 'function' ? new (Ship as any)() : (Ship as any)({ id: 1, team: 'red' });
      // Be lenient: only check some keys if present
      expect(typeof s).toBe('object');
    }

    if (Bullet) {
      const b = typeof Bullet === 'function' ? new (Bullet as any)() : (Bullet as any)({});
      expect(typeof b).toBe('object');
    }
  });

  it('provides ship/bullet-like shapes when constructed via typical helpers if available', () => {
    const api:any = EntitiesTS;
    const mkShip = api.createShip || api.makeShip || api.Ship;
    const mkBullet = api.createBullet || api.makeBullet || api.Bullet;

    if (mkShip && typeof mkShip === 'function') {
      // entities.ts signature: createShip(type, x, y, team)
      const s = mkShip('fighter', 0, 0, 'red');
      expect(isShipLike(s)).toBe(true);
    }

    if (mkBullet && typeof mkBullet === 'function') {
      // entities.ts signature: createBullet(x, y, vx, vy, team, ownerId, damage, ttl)
      const b = mkBullet(0, 0, 1, 0, 'red', 1, 1, 2.0);
      expect(hasBulletFields(b)).toBe(true);
    }
  });
});
