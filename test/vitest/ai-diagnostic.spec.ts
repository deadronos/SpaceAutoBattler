import { it } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { SeededRng } from '../../src/utils/rng.js';
import { generateTraitsFromSeed } from '../../src/game/aiTraits.js';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import fs from 'fs';
import { __aiTestHooks } from '../../src/game/systems.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';

// Lightweight diagnostic — prints per-ship candidate scores for a failing
// scenario so we can see which scoring term flips the top intent.
it('diagnostic: escort + bomber + artillery scenarios candidate breakdown', () => {
  const configs: any[] = [
    {
      name: 'escort',
      seed: 777,
      ships: [
        { id: 1, team: 'blue', hull: 'carrier', position: [0, 0, 0], profileId: 'artillery', hp: 150, maxHp: 200, range: 320 },
        { id: 2, team: 'blue', hull: 'fighter', position: [-60, 0, -40], profileId: 'escort', hp: 30, maxHp: 60, speed: 50 },
        { id: 3, team: 'blue', hull: 'destroyer', position: [-140, 0, 60], profileId: 'artillery', hp: 60, maxHp: 160 },
        { id: 4, team: 'red', hull: 'corvette', position: [320, 0, -40], profileId: 'brawler', hp: 160, maxHp: 160, velocity: [-30, 0, 10] },
        { id: 5, team: 'red', hull: 'frigate', position: [560, 0, 140], profileId: 'artillery', hp: 200, maxHp: 220 },
      ],
    },
    {
      name: 'bomber',
      seed: 2029,
      ships: [
        { id: 1, team: 'blue', hull: 'carrier', position: [0, 0, 0], profileId: 'artillery', hp: 220, maxHp: 220, range: 420 },
        { id: 2, team: 'blue', hull: 'fighter', position: [-80, 0, -40], profileId: 'escort', hp: 55, maxHp: 60, speed: 55 },
        { id: 3, team: 'blue', hull: 'fighter', position: [-90, 0, 60], profileId: 'escort', hp: 60, maxHp: 60, speed: 55 },
        { id: 4, team: 'red', hull: 'destroyer', position: [480, 0, -10], profileId: 'artillery', hp: 260, maxHp: 260, speed: 32, projectileSpeed: 24, velocity: [-45, 0, 6] },
        { id: 5, team: 'red', hull: 'corvette', position: [540, 0, 80], profileId: 'brawler', hp: 140, maxHp: 140, velocity: [-30, 0, -10] },
      ],
    },
    {
      name: 'artillery',
      seed: 4041,
      ships: [
        { id: 1, team: 'blue', hull: 'destroyer', position: [240, 0, 40], profileId: 'artillery', hp: 36, maxHp: 180, speed: 32, range: 480 },
        { id: 2, team: 'blue', hull: 'fighter', position: [-20, 0, -30], profileId: 'escort', hp: 28, maxHp: 60, speed: 48 },
        { id: 3, team: 'red', hull: 'corvette', position: [420, 0, 60], profileId: 'brawler', hp: 160, maxHp: 160, velocity: [-32, 0, -8] },
        { id: 4, team: 'red', hull: 'frigate', position: [520, 0, -120], profileId: 'brawler', hp: 220, maxHp: 220, velocity: [-26, 0, 12] },
      ],
    },
  ];

  for (const config of configs) {
    console.log('\n--- DIAGNOSTIC SCENARIO', config.name, 'seed', config.seed, '---');
    const rng = new SeededRng(config.seed);
    const ships: any[] = config.ships.map((spec: any, idx: number) => {
      const id = spec.id ?? idx + 1;
      const position = new Vector3(...(spec.position as [number, number, number]));
      const rotation = new Quaternion();
      const profileId = spec.profileId ?? 'artillery';
      const traitSeed = rng.int(1, 1_000_000);
      const ai = {
        profileId,
        intent: 'Attack',
        nextThinkAt: 0,
        cooldowns: { dodgeAt: 0, burstAt: 0 },
        lod: 0,
        traitSeed,
        traits: generateTraitsFromSeed(traitSeed),
        targetId: undefined,
        lastScore: undefined,
        command: { heading: new Vector3(0, 0, 1), thrust: 0, firePrimary: false, ttl: 0.1 },
      };

      const ship = {
        id,
        rigidBody: {
          setNextKinematicTranslation: ({ x, y, z }: any) => position.set(x, y, z),
          setNextKinematicRotation: ({ x, y, z, w }: any) => rotation.set(x, y, z, w),
          translation: () => ({ x: position.x, y: position.y, z: position.z }),
          rotation: () => ({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
          linvel: () => ({ x: 0, y: 0, z: 0 }),
        },
        transform: { position, rotation, scale: 1 },
        ship: {
          team: spec.team,
          hull: spec.hull,
          hp: spec.hp ?? 100,
          maxHp: spec.maxHp ?? spec.hp ?? 100,
          shield: spec.shield ?? 0,
          maxShield: spec.maxShield ?? spec.shield ?? 0,
          shieldRegen: 0,
          cooldown: 0,
          fireRate: spec.fireRate ?? 0.8,
          damage: 8,
          projectileSpeed: spec.projectileSpeed ?? 30,
          range: spec.range ?? 260,
          speed: spec.speed ?? 40,
          bulletType: spec.bulletType ?? 'bullet:laser',
          velocity: new Vector3(0, 0, 0),
          angularVelocity: new Vector3(0, 0, 0),
          lateralAcceleration: 0,
          motion: { maxTurnRate: 3 },
        },
        model: spec.hull,
        ai,
      };

      if ((spec as any).velocity) {
        (ship as any).__harnessVelocity = new Vector3(...((spec as any).velocity as [number, number, number]));
      }
      return ship;
    });

    const state: any = {
      ai: {
        enabled: true,
        tickInterval: 0.1,
        tickIndex: 1,
        assignments: { escorts: new Map() },
        metrics: createDefaultMetrics(),
      },
      blackboard: {
        tickIndex: 1,
        teamPosture: { blue: 'hold', red: 'hold' },
        allyCentroid: { blue: new Vector3(), red: new Vector3() },
        nearestEnemy: new Map(),
        threatToVip: new Map(),
        tmpVectors: [],
        strengthRatio: { blue: 1, red: 1 },
        teamPriority: { blue: [], red: [] },
        priorityIndex: { blue: new Map(), red: new Map() },
        focusFire: { blue: new Map(), red: new Map() },
        verticalDispersion: {
          headingYSamples: [],
          positionYSamples: [],
          lastUpdateTick: -1,
        },
      },
      queries: { ships: { entities: ships }, projectiles: { entities: [] }, turrets: { entities: [] } },
      world: { entities: ships },
    };

    // Build blackboard and escort assignments
    __aiTestHooks.refreshBlackboard(state, ships);
    __aiTestHooks.assignTeamRoles(state, ships);

  // For each ship print score breakdown
  for (const ship of ships) {
      const ai = ship.ai;
      const profile = resolveBehaviorProfile(ai.profileId);
      const primaryId = state.blackboard.nearestEnemy.get(ship.id);
      const primary = primaryId != null ? ships.find((s) => s.id === primaryId) ?? null : null;
      const escortAssignment = state.ai.assignments.escorts.get(ship.id) ?? null;
      const escort = escortAssignment ? ships.find((s) => s.id === escortAssignment.vipId) ?? null : null;

      const attack = __aiTestHooks.scoreAttackIntent(ship, profile, primary, state.blackboard.teamPosture[ship.ship.team], ai.traits);
      const kite = __aiTestHooks.scoreKiteIntent(ship, profile, primary, state.blackboard.teamPosture[ship.ship.team], ai.traits);
      const escortScore = escort
        ? __aiTestHooks.scoreEscortIntent(ship, profile, escort, state, ai.traits, escortAssignment)
        : 0;
      const intercept = primary
        ? __aiTestHooks.scoreInterceptIntent(
            state,
            ship,
            profile,
            primary,
            escort,
            state.blackboard.teamPosture[ship.ship.team],
            ai.traits,
            escortAssignment,
          )
        : 0;
      const reposition = __aiTestHooks.scoreRepositionIntent(state, ship, profile, primary, ai.traits, state.blackboard.teamPosture[ship.ship.team]);
      const regroup = __aiTestHooks.scoreRegroupIntent(state, ship, profile, state.blackboard.teamPosture[ship.ship.team], ai.traits);
      const flee = __aiTestHooks.scoreFleeIntent(ship, profile, primary, state.blackboard.teamPosture[ship.ship.team], ai.traits);

      // Print a compact diagnostic line and append to log file
      const line = `Ship ${ship.id} (${ship.ship.hull}) primary:${primary?.id ?? 'none'} escort:${escort?.id ?? 'none'} -> attack:${attack} intercept:${intercept} escort:${escortScore} kite:${kite} reposition:${reposition} regroup:${regroup} flee:${flee}\n`;
      const chosen = __aiTestHooks.selectIntent(state, ship, ai, profile, primary, escort, escortAssignment);
      const chosenLine = `  selected -> ${chosen.intent} ${chosen.score}\n`;
      fs.appendFileSync('tmp/ai-diagnostic.log', line + chosenLine);
      console.log(line + chosenLine);
    }
  }
});
