import { Quaternion, Vector3 } from 'three';
import type { SeededRng } from '../../utils/rng.js';
import { createDefaultMotionStats, SHIP_STATS } from '../ships.js';
import { createProgressionDefaults, createSubsystems } from '../progression.js';
import type { AIScenarioShipConfig, HarnessShip } from './types.js';
import { createHarnessAIState } from './aiDefaults.js';
import { createRigidBodyShim } from './rapierShim.js';

/**
 * Creates a lightweight ship entity for AI scenario harness.
 * Ship-specific helpers and construction logic.
 */
export function createHarnessShip(
  spec: AIScenarioShipConfig,
  index: number,
  rng: SeededRng,
  tickInterval: number,
): HarnessShip {
  const id = spec.id ?? index + 1;
  const position = new Vector3(...spec.position);
  const rotation = new Quaternion();
  const hull = spec.hull;
  const maxHp = spec.maxHp ?? spec.hp ?? 100;
  const hp = spec.hp ?? maxHp;
  const maxShield = spec.maxShield ?? spec.shield ?? 0;
  const shield = spec.shield ?? maxShield;
  const progression = createProgressionDefaults(hull);
  const subsystems = createSubsystems(maxHp);

  const ai = createHarnessAIState(hull, spec.profileId, spec.traitSeed, rng, tickInterval);

  const ship: HarnessShip = {
    id,
    rigidBody: createRigidBodyShim(position, rotation, spec.velocity),
    collider: {} as never,
    transform: { position, rotation, scale: 1 },
    ship: {
      team: spec.team,
      hull,
      xp: progression.xp,
      level: progression.level,
      xpToNext: progression.xpToNext,
      damageType: progression.damageType,
      levelBonuses: progression.levelBonuses,
      captain: progression.captain,
      subsystems,
      armor: progression.armor,
      hp,
      maxHp,
      shield,
      maxShield,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: spec.fireRate ?? 0.8,
      damage: 8,
      projectileSpeed: spec.projectileSpeed ?? 40,
      range: spec.range ?? 260,
      speed: spec.speed ?? 40,
      bulletType: spec.bulletType ?? 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
      sensor: { ...SHIP_STATS[hull].sensor },
      stealth: SHIP_STATS[hull].stealth ?? 0,
      sensorSignature: SHIP_STATS[hull].sensorSignature ?? 1,
    },
    model: hull,
    ai,
  } as HarnessShip;

  if (spec.velocity) {
    ship.__harnessVelocity = new Vector3(...spec.velocity);
  }

  return ship;
}
