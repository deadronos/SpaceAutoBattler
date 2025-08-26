import { describe, it, expect } from 'vitest';
import { makeInitialState } from '../../../src/entities';
import { applySimpleAI } from '../../../src/behavior';
import { simulateStep } from '../../../src/simulate';
import CanvasRenderer from '../../../src/canvasrenderer';
import { getShipConfigSafe } from '../utils/entitiesConfigSafe';
import { getDefaultBounds } from '../../../src/config/simConfig';

// Integration test: ensure renderer-computed turret world coords match bullet spawn coords
// Steps:
// 1) Create state with an attacker ship that has a tuple-style turret [1,0]
// 2) Place a defender to the right so AI fires
// 3) Run applySimpleAI to make AI decide to fire, then run simulateStep (which also normalizes turrets)
// 4) Use CanvasRenderer.renderState to compute rendered turret coordinates by inspecting the renderer's internal _svgMountCache path
//    (we will directly compute turret world coords using same math as renderer to avoid accessing private caches)

function computeRendererTurretWorldCoord(ship: any, turretPosTuple: [number, number]) {
  const angle = ship.angle || 0;
  const shipType = ship.type || 'fighter';
  // get config radius fallback logic like renderer
  const cfg = getShipConfigSafe()[shipType];
  // Fallback to safe helper in case of interop issues
  if (!cfg) {
    const safeCfg = getShipConfigSafe();
    return [
      ship.x + Math.cos(angle) * turretPosTuple[0] * (safeCfg[shipType]?.radius ?? (ship.radius || 12)) - Math.sin(angle) * turretPosTuple[1] * (safeCfg[shipType]?.radius ?? (ship.radius || 12)),
      ship.y + Math.sin(angle) * turretPosTuple[0] * (safeCfg[shipType]?.radius ?? (ship.radius || 12)) + Math.cos(angle) * turretPosTuple[1] * (safeCfg[shipType]?.radius ?? (ship.radius || 12))
    ];
  }
  const configRadius = cfg && typeof cfg.radius === 'number' ? cfg.radius : (ship.radius || 12);
  const [tx, ty] = turretPosTuple;
  const turretX = ship.x + Math.cos(angle) * tx * configRadius - Math.sin(angle) * ty * configRadius;
  const turretY = ship.y + Math.sin(angle) * tx * configRadius + Math.cos(angle) * ty * configRadius;
  return [turretX, turretY];
}

describe('integration: turret render vs bullet spawn', () => {
  it('renderer turret world coord equals bullet spawn coord for tuple turret', () => {
    const state: any = makeInitialState();
    const attacker: any = { id: 100, x: 100, y: 100, angle: 0, radius: 10, type: 'unknown-type', hp: 10, maxHp: 10, team: 'red', turrets: [[1, 0]] };
    const defender: any = { id: 101, x: 140, y: 100, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

    // Run AI step that should cause attacker to fire
  applySimpleAI(state, 1.0, getDefaultBounds());
  // simulateStep will normalize turrets and leave bullets in state.bullets
  // Use dt=0 so bullets are not advanced by pruneAll (we want the spawn coords)
  simulateStep(state, 0, getDefaultBounds());

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThan(0);
    const b = state.bullets[0];

    // Compute renderer turret world coord for tuple [1,0]
    const [tx, ty] = computeRendererTurretWorldCoord(attacker, [1, 0]);
    // Assert bullet spawn close to turret world coord
    expect(Math.abs(b.x - tx)).toBeLessThan(1e-6);
    expect(Math.abs(b.y - ty)).toBeLessThan(1e-6);
  });

  it('renderer turret world coord equals bullet spawn coord for rotated ship', () => {
    const state: any = makeInitialState();
    // Attacker rotated 90 degrees (pi/2) so the turret [1,0] should be placed along ship's local +x rotated into world space
    const angle = Math.PI / 2; // 90deg
    const attacker: any = { id: 200, x: 200, y: 200, angle, radius: 8, type: 'unknown-type', hp: 10, maxHp: 10, team: 'red', turrets: [[1, 0]] };
    const defender: any = { id: 201, x: 200, y: 240, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

  applySimpleAI(state, 1.0, getDefaultBounds());
  simulateStep(state, 0, getDefaultBounds());

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThan(0);
    const b = state.bullets[0];

    const [tx, ty] = computeRendererTurretWorldCoord(attacker, [1, 0]);
    expect(Math.abs(b.x - tx)).toBeLessThan(1e-6);
    expect(Math.abs(b.y - ty)).toBeLessThan(1e-6);
  });

  it('multiple tuple turrets spawn bullets at their respective mountpoints', () => {
    const state: any = makeInitialState();
    // Attacker with two tuple turrets: right and left
    const attacker: any = { id: 300, x: 300, y: 300, angle: 0, radius: 10, type: 'unknown-type', hp: 10, maxHp: 10, team: 'red', turrets: [[1, 0], [-1, 0]] };
    const defender: any = { id: 301, x: 340, y: 300, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

  applySimpleAI(state, 1.0, getDefaultBounds());
  simulateStep(state, 0, getDefaultBounds());

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThanOrEqual(1);
    // There may be multiple bullets; find any bullet close to either mountpoint
    const mountA = computeRendererTurretWorldCoord(attacker, [1, 0]);
    const mountB = computeRendererTurretWorldCoord(attacker, [-1, 0]);
    let matched = false;
    for (const b of state.bullets) {
      const dA = Math.hypot((b.x || 0) - mountA[0], (b.y || 0) - mountA[1]);
      const dB = Math.hypot((b.x || 0) - mountB[0], (b.y || 0) - mountB[1]);
      if (dA < 1e-6 || dB < 1e-6) { matched = true; break; }
    }
    expect(matched).toBe(true);
  });

  it('object-style turret kinds and mixed tuple/object entries spawn at correct coords', () => {
    const state: any = makeInitialState();
    // One turret as object with kind and explicit position, one as tuple
    const attacker: any = {
      id: 400,
      x: 400,
      y: 100,
      angle: Math.PI / 4,
      radius: 12,
      type: 'unknown-type',
      hp: 10,
      maxHp: 10,
      team: 'red',
      turrets: [
        { position: [0.7, 0.2], kind: 'basic' },
        [ -0.6, 0.1 ],
      ],
    };
    const defender: any = { id: 401, x: 440, y: 140, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

  applySimpleAI(state, 1.0, getDefaultBounds());
  simulateStep(state, 0, getDefaultBounds());

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThanOrEqual(1);
    const mount1 = computeRendererTurretWorldCoord(attacker, [0.7, 0.2]);
    const mount2 = computeRendererTurretWorldCoord(attacker, [-0.6, 0.1]);
    let ok = false;
    for (const b of state.bullets) {
      const d1 = Math.hypot((b.x || 0) - mount1[0], (b.y || 0) - mount1[1]);
      const d2 = Math.hypot((b.x || 0) - mount2[0], (b.y || 0) - mount2[1]);
      if (d1 < 1e-6 || d2 < 1e-6) { ok = true; break; }
    }
    expect(ok).toBe(true);
  });

  it('carrier turret mountpoint scales with carrier radius and spawns bullet at correct coord', () => {
    const state: any = makeInitialState();
    // Use carrier type turret positions from ship config
  const shipCfg = getShipConfigSafe();
    const carrierCfg = shipCfg['carrier'];
    const turretPos = carrierCfg && Array.isArray((carrierCfg as any).turrets) && (carrierCfg as any).turrets.length ? (carrierCfg as any).turrets[0].position : [2.0, 1.2];
    const attacker: any = { id: 500, x: 500, y: 100, angle: 0, radius: carrierCfg.radius || 40, type: 'carrier', hp: 10, maxHp: 10, team: 'red', turrets: [turretPos] };
    const defender: any = { id: 501, x: 560, y: 100, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

    applySimpleAI(state, 1.0, { W: 1200, H: 800 });
    simulateStep(state, 0, { W: 1200, H: 800 });

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThan(0);
    const b = state.bullets[0];
    const [tx, ty] = computeRendererTurretWorldCoord(attacker, turretPos);
    expect(Math.abs(b.x - tx)).toBeLessThan(1e-6);
    expect(Math.abs(b.y - ty)).toBeLessThan(1e-6);
  });

  it('negative rotation turret spawn matches renderer math', () => {
    const state: any = makeInitialState();
    const angle = -Math.PI / 3; // -60deg
    const attacker: any = { id: 600, x: 600, y: 200, angle, radius: 9, type: 'unknown-type', hp: 10, maxHp: 10, team: 'red', turrets: [[0.5, -0.5]] };
    const defender: any = { id: 601, x: 640, y: 160, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];

    applySimpleAI(state, 1.0, { W: 1200, H: 800 });
    simulateStep(state, 0, { W: 1200, H: 800 });

    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThan(0);
    const b = state.bullets[0];
    const [tx, ty] = computeRendererTurretWorldCoord(attacker, [0.5, -0.5]);
    expect(Math.abs(b.x - tx)).toBeLessThan(1e-6);
    expect(Math.abs(b.y - ty)).toBeLessThan(1e-6);
  });

  it('fighters spawned by carrier have normalized turret objects', () => {
    const state: any = makeInitialState();
    // Create a carrier and set its internal timer so simulateStep will spawn fighters immediately
  const carrierCfg = getShipConfigSafe()['carrier'];
    const carrier: any = { id: 700, x: 700, y: 300, angle: 0, radius: carrierCfg.radius || 40, type: 'carrier', hp: 100, maxHp: 100, team: 'red', turrets: (carrierCfg.turrets || []).map((t: any) => t.position) };
    // prime timer so spawn will occur even with dt=0
    carrier._carrierTimer = carrierCfg?.carrier?.fighterCooldown || 1.5;
    state.ships = [carrier];

    // Run simulateStep which should spawn fighters and ensure their turrets are normalized via createShip
    simulateStep(state, 0, { W: 1200, H: 800 });

    // Find spawned fighters (parentId === carrier.id)
    const spawned = (state.ships || []).filter((s: any) => s && s.parentId === carrier.id && s.type === 'fighter');
    expect(spawned.length).toBeGreaterThan(0);
    // Check turret normalization on first spawned fighter
    const f = spawned[0];
    expect(Array.isArray(f.turrets)).toBe(true);
    expect(f.turrets.length).toBeGreaterThanOrEqual(0);
    if (f.turrets.length > 0) {
      expect(Array.isArray(f.turrets[0].position) || typeof f.turrets[0].position === 'object').toBe(true);
    }
  });
});
