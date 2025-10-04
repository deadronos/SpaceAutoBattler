import { Vector3 } from 'three';
import { resolveBehaviorProfile } from '../src/game/aiProfiles.js';
import { __aiTestHooks } from '../src/game/systems.js';
import { useUiStore } from '../src/game/uiStore.js';
import { createDefaultMetrics } from '../src/game/metrics.js';
import { getEffectiveAIConfig } from '../src/game/config.js';

const { writeCommand } = __aiTestHooks;

function createState() {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 30,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: createDefaultMetrics(),
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
      strengthRatio: { blue: 1, red: 1 },
    },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: /**/ null,
    physicsWorld: /**/ null,
    eventQueue: /**/ null,
    colliderLookup: new Map(),
    rapier: /**/ null,
    nextEntityId: 1,
    time: 0,
    rng: /**/ null,
    paused: false,
    timeScale: 1,
    simulation: { step: 1 / 20, accumulator: 0, maxSubSteps: 5, alpha: 0, lastTickIndex: 0, lastTickStart: 0, lastTickDuration: 1 / 20, deferredMutations: [], postStepMutations: [], rapierDiagnostics: { deferredMutationFailures: 0, guardTrips: 0, lastFailureTick: -1, lastGuardTick: -1, lastDeferredMutationError: undefined } },
  };
}

function createShip(id, profileId = 'brawler') {
  const heading = new Vector3(0, 0, 1);
  const ai = {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 1,
    traits: { aggression: 1, patience: 1, dodge: 1 },
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    command: { heading, thrust: 0, firePrimary: false, ttl: 0 },
  };
  const ship = {
    id,
    transform: { position: new Vector3(), rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 },
    ship: { team: 'blue', hull: 'fighter', hp: 100, maxHp: 100, shield: 0, maxShield: 0, cooldown: 0, fireRate: 1, damage: 6, projectileSpeed: 30, range: 260, speed: 40, velocity: new Vector3(), angularVelocity: new Vector3(), lateralAcceleration: 0, motion: {} },
    ai,
  };
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
  const state = createState();
  const ship = createShip(1, 'brawler');
  const profile = resolveBehaviorProfile('brawler');
  const target = createShip(2, 'brawler');
  target.transform.position.set(0,0,400);

  const store = useUiStore.getState();
  const original = store.aiSmoothingEnabled;
  console.log('before set off, effective smoothingEnabled=', getEffectiveAIConfig().smoothingEnabled);
  store.setAiSmoothingEnabled?.(false);
  console.log('after set off, effective smoothingEnabled=', getEffectiveAIConfig().smoothingEnabled);
  const headingsOff=[];
  for (let t=0;t<8;t++){
    state.ai.tickIndex=t;
    writeCommand(state, ship, ship.ai, profile, target, null, null);
    headingsOff.push(ship.ai.command.heading.clone());
  }
  store.setAiSmoothingEnabled?.(true);
  console.log('after set on, effective smoothingEnabled=', getEffectiveAIConfig().smoothingEnabled);
  const headingsOn=[];
  for (let t=10;t<18;t++){
    state.ai.tickIndex=t;
    writeCommand(state, ship, ship.ai, profile, target, null, null);
    headingsOn.push(ship.ai.command.heading.clone());
  }
  store.setAiSmoothingEnabled?.(original ?? null);
  console.log('off deltas:', headingsOff.map((h,i)=>i===0?0:h.clone().sub(headingsOff[i-1]).length()))
  console.log('on deltas:', headingsOn.map((h,i)=>i===0?0:h.clone().sub(headingsOn[i-1]).length()))
  console.log('offMean',meanHeadingDelta(headingsOff), 'onMean', meanHeadingDelta(headingsOn));
})();
