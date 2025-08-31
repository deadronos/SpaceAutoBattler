import { describe, it, expect } from 'vitest';
import { IntentManager } from '../../src/core/ai/intentManager.js';
import type { AIPersonality } from '../../src/config/behaviorConfig.js';
import type { Ship } from '../../src/types/index.js';
import { createRNG } from '../../src/utils/rng.js';

function makePersonality(): AIPersonality {
  return {
    mode: 'aggressive',
    intentReevaluationRate: 1,
    minIntentDuration: 3,
    maxIntentDuration: 10,
    aggressiveness: 0.8,
    caution: 0.2,
    groupCohesion: 0.4,
    preferredRangeMultiplier: 1.0,
  } as AIPersonality;
}

function makeShip(): Ship {
  return {
    id: 1,
    team: 'red',
    class: 'fighter',
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    dir: 0,
    targetId: null,
    health: 100,
    maxHealth: 100,
    armor: 0,
    shield: 0,
    maxShield: 0,
    shieldRegen: 0,
    speed: 100,
    turnRate: Math.PI,
    turrets: [],
    kills: 0,
    level: { level: 1, xp: 0, nextLevelXp: 10 },
  } as unknown as Ship;
}

describe('IntentManager', () => {
  it('computes duration within [min,max] and applies to ship', () => {
    const im = new IntentManager();
    const rng = createRNG('seed-1');
    const p = makePersonality();
    const ship = makeShip();

    const duration = im.applyIntent(ship, 5, 'pursue', p, rng);
    expect(duration).toBeGreaterThanOrEqual(p.minIntentDuration);
    expect(duration).toBeLessThanOrEqual(p.maxIntentDuration);
    expect(ship.aiState!.currentIntent).toBe('pursue');
    expect(ship.aiState!.intentEndTime).toBeCloseTo(5 + duration, 6);
  });

  it('applies damage-evade shortening before randomness (parity)', () => {
    const im = new IntentManager();
    const rng = createRNG('seed-2');
    const p = makePersonality();
    const ship = makeShip();

    const short = 2.0; // shorter than p.minIntentDuration
    const duration = im.applyIntent(ship, 10, 'evade', p, rng, { damageEvade: true, damageEvadeDuration: short });
    expect(duration).toBeGreaterThanOrEqual(short);
    expect(duration).toBeLessThanOrEqual(p.maxIntentDuration);
    expect(ship.aiState!.currentIntent).toBe('evade');
    expect(ship.aiState!.intentEndTime).toBeCloseTo(10 + duration, 6);
  });
});
