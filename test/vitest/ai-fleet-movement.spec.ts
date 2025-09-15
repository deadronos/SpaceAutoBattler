// Diagnostic: spawn multiple ships and capture intents/vel/pos after stepping
if (typeof process !== 'undefined') {
  process.env.VITEST_AI_DEBUG = '1';
}
import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep, spawnFleet } from '../../src/core/gameState.js';

describe('AI fleet movement diagnostic', () => {
  it('spawns fleets and captures movement summary', () => {
    const state = createInitialState('test-seed-fleet');
    state.behaviorConfig!.globalSettings.aiEnabled = true;
    state.behaviorConfig!.globalSettings.enableSpawnJitter = false;

    // Force fighters to roaming personality so they explore/move
    if (state.behaviorConfig!.shipPersonalities) {
      state.behaviorConfig!.shipPersonalities.fighter = {
        ...(state.behaviorConfig!.shipPersonalities.fighter || {}),
        mode: 'roaming',
        intentReevaluationRate: 0.3,
        minIntentDuration: 0.3,
        maxIntentDuration: 1,
        aggressiveness: 0.5,
        caution: 0.5,
        groupCohesion: 0.5,
        preferredRangeMultiplier: 1.0,
      };
    }

    // Spawn 6 per team using spawnShip to keep deterministic positions
    const reds = [] as any[];
    const blues = [] as any[];
    for (let i = 0; i < 6; i++) {
      reds.push(spawnShip(state, 'red', 'fighter'));
      blues.push(spawnShip(state, 'blue', 'fighter'));
    }

    // Ensure aiState exists and allow immediate reevaluation (use -1e9 so controller reevaluates)
    for (const s of [...reds, ...blues]) {
      if (!s.aiState) s.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: -1e9, preferredRange: 0, recentDamage: 0, lastDamageTime: 0 } as any;
      else s.aiState.lastIntentReevaluation = -1e9;
    }

    // Step simulation multiple times
    for (let t = 0; t < 20; t++) simulateStep(state, 0.1);

    // Build summary
    const summary: Record<string, any> = {};
    for (const s of state.ships) {
      summary[`${s.team}-${s.id}`] = {
        id: s.id,
        team: s.team,
        class: s.class,
        pos: s.pos,
        prevPos: s.prevPos,
        vel: s.vel,
        intent: s.aiState?.currentIntent ?? null,
        target: s.targetId ?? null,
        roamingAnchor: s.aiState?.roamingAnchor ?? null,
      };
    }

    try {
       
      const fs = require('fs');
      fs.writeFileSync('tmp/ai-movement-summary.json', JSON.stringify(summary, null, 2));
    } catch {}

    // Sanity: at least one ship should have non-zero vel or pos change
    const moved = state.ships.some((s) => Math.abs(s.pos.x - s.prevPos!.x) > 1e-6 || Math.abs(s.vel.x) > 1e-6);
    expect(moved).toBeTruthy();
  });
});
