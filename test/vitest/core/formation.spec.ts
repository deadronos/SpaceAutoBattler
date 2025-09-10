import { describe, it, expect } from 'vitest';

import {
  findBestFormation,
  getFormationCenter,
  assignFormationSlot,
  clearFormationSlot,
} from '../../../src/core/ai/formation';

describe('formation module', () => {
  it('returns escort formation when carrier nearby', () => {
    const carrier = {
      id: 10,
      team: 'red',
      class: 'carrier',
      health: 100,
      pos: { x: 10, y: 0, z: 0 },
    } as any;
    const ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      health: 100,
      pos: { x: 12, y: 0, z: 0 },
    } as any;
    const state: any = {
      ships: [carrier, ship],
      behaviorConfig: {
        globalSettings: { formationSearchRadius: 50, formationMinGroupSize: 3 },
        formations: { escort: { type: 'escort', maxSize: 3, spacing: 10 } },
      },
    };
    const res = findBestFormation(state, ship);
    expect(res).not.toBeNull();
    expect(res!.name).toBe('escort');
  });

  it('returns line formation when many nearby friends', () => {
    const ship = {
      id: 1,
      team: 'blue',
      class: 'fighter',
      health: 100,
      pos: { x: 0, y: 0, z: 0 },
    } as any;
    const friends = [
      ship,
      { id: 2, team: 'blue', class: 'fighter', health: 100, pos: { x: 1, y: 0, z: 0 } },
      { id: 3, team: 'blue', class: 'fighter', health: 100, pos: { x: 2, y: 0, z: 0 } },
    ];
    const cfg: any = {
      globalSettings: { formationSearchRadius: 100, formationMinGroupSize: 2 },
      formations: { line: { type: 'line', maxSize: 8, spacing: 10 } },
    };
    const state: any = { ships: friends, behaviorConfig: cfg };
    const res = findBestFormation(state, ship);
    expect(res).not.toBeNull();
    expect(res!.name).toBe('line');
  });

  it('computes formation center and assigns unique slots', () => {
    const s1 = { id: 1, team: 'red', pos: { x: 0, y: 0, z: 0 } } as any;
    const s2 = { id: 2, team: 'red', pos: { x: 10, y: 0, z: 0 } } as any;
    const state: any = {
      ships: [s1, s2],
      behaviorConfig: { globalSettings: { formationSearchRadius: 100 } },
    };
    const center = getFormationCenter(state, s1, 'line');
    expect(center).not.toBeNull();
    // findNearbyFriends returns friends excluding the ship itself, so with only s2 as a friend
    // the center should equal s2.position (x=10)
    expect(center!.x).toBeCloseTo(10);

    const formationConfig: any = { type: 'line', maxSize: 4, spacing: 10 };
    assignFormationSlot(state, s1 as any, 'line', formationConfig, center!);
    assignFormationSlot(state, s2 as any, 'line', formationConfig, center!);
    expect(s1.aiState).toBeDefined();
    expect(s2.aiState).toBeDefined();
    expect(typeof s1.aiState.formationSlotIndex).toBe('number');
    expect(typeof s2.aiState.formationSlotIndex).toBe('number');
    expect(s1.aiState.formationSlotIndex).not.toBe(s2.aiState.formationSlotIndex);

    clearFormationSlot(state as any, s1 as any);
    expect(s1.aiState.formationId).toBeUndefined();
  });
});
