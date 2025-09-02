import { describe, it, expect } from 'vitest';
import { ProjectileSystem } from '../../src/core/systems/projectileSystem';
import { getShipClassConfig } from '../../src/config/entitiesConfig';
import { createMockShip } from './setupTests';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig';

// Simple deterministic LCG RNG for tests
class TestRNG {
  private state: number;
  constructor(seed = 12345) { this.state = seed >>> 0; }
  next() {
    // 32-bit LCG
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  int(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr){ return arr[Math.floor(this.next() * arr.length)]; }
}

function vecLen(v: {x:number,y:number,z:number}){ return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z); }
function normalize(v:{x:number,y:number,z:number}){ const l=vecLen(v)||1; return {x:v.x/l,y:v.y/l,z:v.z/l}; }
function dot(a:{x:number,y:number,z:number}, b:{x:number,y:number,z:number}){ return a.x*b.x + a.y*b.y + a.z*b.z; }

function computeFinalInaccuracy(turretAccuracy:number|undefined, shipLevel:number, perLevel:number, maxReduction:number){
  const turretAcc = typeof turretAccuracy === 'number' ? turretAccuracy : 1.0;
  const baseInaccuracy = Math.max(0, 1 - turretAcc);
  const levelReduction = Math.max(0, Math.min(maxReduction, (shipLevel - 1) * perLevel));
  return baseInaccuracy * (1 - levelReduction);
}

describe('ProjectileSystem sampling integration', () => {
  it('samples bullets within computed cone for different levels', () => {
    const rng = new TestRNG(42);

    const state: any = {
      time: 0,
      tick: 0,
      running: true,
      speedMultiplier: 1,
      rng,
      nextId: 1000,
      simConfig: { bulletLifetime: 5 },
      ships: [],
      bullets: [],
      behaviorConfig: DEFAULT_BEHAVIOR_CONFIG
    };

    // create a fighter ship
    const shipClass = 'fighter';
    const shipConfig = getShipClassConfig(shipClass as any);
    const turretCfg = shipConfig.turrets[0];

    const turretState = { id: turretCfg.id, cooldownLeft: 0 };
    const ship = createMockShip({
      id: 1,
      team: 'red',
      class: shipClass,
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      turrets: [turretState],
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      aiState: {},
      armor: 0,
      speed: 0,
      turnRate: 0
    }) as any;

    state.ships.push(ship);

    const ps = new ProjectileSystem(state as any);

    const targetPos = { x: 200, y: 0, z: 0 };
    const aimDir = normalize({ x: targetPos.x - ship.pos.x, y: targetPos.y - ship.pos.y, z: targetPos.z - ship.pos.z });

    const perLevel = state.behaviorConfig.globalSettings.turretLevelAccuracyPerLevel ?? 0.02;
    const maxReduction = state.behaviorConfig.globalSettings.turretLevelAccuracyMaxReduction ?? 0.5;
    const turretAccuracy = (turretCfg as any).accuracy;
    const maxSpread = (turretCfg as any).maxSpreadRadians;

    // Test for level 1 and level 10
    for (const level of [1, 10]){
      ship.level.level = level;

      // compute expected cone angle
      const finalInaccuracy = computeFinalInaccuracy(turretAccuracy, level, perLevel, maxReduction);
      const coneAngle = finalInaccuracy * maxSpread;

      // fire multiple shots, resetting cooldown each time
      for (let i=0;i<20;i++){
        turretState.cooldownLeft = 0;
        state.bullets.length = 0; // clear
        const id = ps.fire({ sourceShipId: ship.id, turretId: turretState.id, targetPosition: targetPos });
        expect(id).not.toBeNull();
        expect(state.bullets.length).toBeGreaterThan(0);
        const bullet = state.bullets[ state.bullets.length - 1 ];
        const bulletDir = normalize({ x: bullet.vel.x, y: bullet.vel.y, z: bullet.vel.z });
        const cosAngle = dot(aimDir, bulletDir);
        // clamp numeric errors
        const clamped = Math.max(-1, Math.min(1, cosAngle));
        const angle = Math.acos(clamped);
        // angle should be within coneAngle (allow tiny epsilon)
        expect(angle).toBeLessThanOrEqual(coneAngle + 1e-8);
      }
    }
  });
});
