import { describe, expect, it } from 'vitest';

import {
  clampSimulationSubsteps,
  MAX_ALLOWED_SIMULATION_SUBSTEPS,
} from '../../src/components/BattlefieldSystems.js';

describe('clampSimulationSubsteps', () => {
  it('returns at most the configured maximum', () => {
    const moreThanMax = MAX_ALLOWED_SIMULATION_SUBSTEPS + 3;
    expect(clampSimulationSubsteps(moreThanMax)).toBe(MAX_ALLOWED_SIMULATION_SUBSTEPS);
  });

  it('floors fractional inputs and enforces the minimum of 1', () => {
    expect(clampSimulationSubsteps(2.7)).toBe(2);
    expect(clampSimulationSubsteps(0)).toBe(1);
    expect(clampSimulationSubsteps(-5)).toBe(1);
  });

  it('handles non-finite values safely', () => {
    expect(clampSimulationSubsteps(Number.NaN)).toBe(1);
  });
});
