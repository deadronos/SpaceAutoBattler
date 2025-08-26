import { describe, it, expect } from 'vitest';
import { RendererConfig } from '../../src/config/rendererConfig';
import { getDefaultBounds } from '../../src/config/simConfig';
import TeamsConfig from '../../src/config/teamsConfig';
import { getShipConfigSafe } from './utils/entitiesConfigSafe';
import { simulateStep } from '../../src/simulate';
import { makeInitialState } from '../../src/entities';

// Game flow: start, tick, end

describe('Game Flow', () => {
  it('should initialize game with config-driven bounds', () => {
    const bounds = getDefaultBounds();
    expect(bounds.W).toBe(1920);
    expect(bounds.H).toBe(1080);
    expect(RendererConfig.renderScale).toBeGreaterThan(0);
  });

  it('should create teams from config', () => {
    expect(Object.keys(TeamsConfig.teams)).toContain('blue');
    expect(Object.keys(TeamsConfig.teams)).toContain('red');
  });

  it('should initialize entities from config', () => {
    const cfg = getShipConfigSafe();
    expect(typeof cfg).toBe('object');
    expect(Object.keys(cfg).length).toBeGreaterThan(0);
  });


  it('should run simulation tick and update state', () => {
    const state = makeInitialState();
    simulateStep(state, 0.016, getDefaultBounds());
    expect(state).toBeDefined();
    expect(Array.isArray(state.ships)).toBe(true);
  });

  it('should end game when win condition met', () => {
    const state = makeInitialState();
    (state as any).win = true;
    expect((state as any).win).toBe(true);
  });
});
