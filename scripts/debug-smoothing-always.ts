import { Vector3 } from 'three';
import { resolveBehaviorProfile } from '../src/game/aiProfiles.js';
import { __aiTestHooks } from '../src/game/systems.js';
import { useUiStore } from '../src/game/uiStore.js';
import { createDefaultMetrics } from '../src/game/metrics.js';
import { getEffectiveAIConfig } from '../src/game/config.js';

const { writeCommand } = __aiTestHooks;

function createState() {
  return {
    ai: { tickIndex: 0, tickInterval: 0.1, metrics: createDefaultMetrics(), enabled: true, maxPerTick: 30, accumulator: 0, cursor: 0, slices: 1, assignments: { escorts: new Map() }, tickIndex: 0 },
    blackboard: { tickIndex: 0, teamPosture: { blue: 'hold', red: 'hold' }, allyCentroid: { blue: new Vector3(), red: new Vector3() }, nearestEnemy: new Map(), threatToVip: new Map(), tmpVectors: [], strengthRatio: { blue: 1, red: 1 } },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: null, physicsWorld: null, eventQueue: null, colliderLookup: new Map(), rapier: null, nextEntityId: 1, time: 0, rng: null, paused: false, timeScale: 1,
    simulation: { step: 1 / 20, accumulator: 0, maxSubSteps: 5, alpha: 0, lastTickIndex: 0, lastTickStart: 0, lastTickDuration: 1 / 20, deferredMutations: [], postStepMutations: [], rapierDiagnostics: { deferredMutationFailures: 0, guardTrips: 0, lastFailureTick: -1, lastGuardTick: -1, lastDeferredMutationError: undefined } },
  };
}

function createShip(id) {
  const heading = new Vector3(0, 0, 1);
  const ai = { profileId: 'brawler', intent: 'Attack', nextThinkAt: 0, cooldowns: { dodgeAt: 0, burstAt: 0 }, lod: 0, traitSeed: 1, traits: { aggression: 1, patience: 1, dodge: 1 }, stickinessUntil: 0, stickinessHeading: new Vector3(0, 0, 1), command: { heading, thrust: 0, firePrimary: false, ttl: 0 } };
  const ship = { id, transform: { position: new Vector3(), rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 }, ship: { team: 'blue', hull: 'fighter', hp: 100, maxHp: 100, shield: 0, maxShield: 0, cooldown: 0, fireRate: 1, damage: 6, projectileSpeed: 30, range: 260, speed: 40, velocity: new Vector3(), angularVelocity: new Vector3(), lateralAcceleration: 0, motion: {} }, ai };
  return ship;
}

function meanHeadingDelta(headings) {
  if (headings.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < headings.length; i++) {
    sum += headings[i].clone().sub(headings[i - 1]).length();
  }
  return sum / (headings.length - 1);
}

(async function main(){
  const store = useUiStore.getState();
  const original = store.aiSmoothingEnabled;

  // Case 1: smoothing always disabled
  store.setAiSmoothingEnabled?.(false);
  const state1 = createState();
  const ship1 = createShip(1);
  const target1 = createShip(2);
  target1.transform.position.set(0,0,400);
  const headings1=[];
  for (let t=0;t<8;t++){
    state1.ai.tickIndex=t;
    writeCommand(state1, ship1, ship1.ai, resolveBehaviorProfile('brawler'), target1, null, null);
    headings1.push(ship1.ai.command.heading.clone());
  }

  // Case 2: smoothing always enabled
  store.setAiSmoothingEnabled?.(true);
  const state2 = createState();
  const ship2 = createShip(1);
  const target2 = createShip(2);
  target2.transform.position.set(0,0,400);
  const headings2=[];
  for (let t=0;t<8;t++){
    state2.ai.tickIndex=t;
    writeCommand(state2, ship2, ship2.ai, resolveBehaviorProfile('brawler'), target2, null, null);
    headings2.push(ship2.ai.command.heading.clone());
  }

  store.setAiSmoothingEnabled?.(original ?? null);
  console.log('alwaysOff mean',meanHeadingDelta(headings1),'alwaysOn mean',meanHeadingDelta(headings2));
})();
