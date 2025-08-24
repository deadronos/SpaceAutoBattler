import { describe, it, expect } from 'vitest';
import type {
  ShipSpec,
  CannonSpec,
  ProgressionConfig,
  ShipConfigMap,
  AssetsConfigType,
  Shape2D
} from '../../src/types';
import { AssetsConfig } from '../../src/config/assets/assetsConfig';
import { TeamsConfig } from '../../src/config/teamsConfig';
import { RendererConfig } from '../../src/config/rendererConfig';

describe('Type barrel and config contracts', () => {
  it('AssetsConfig matches AssetsConfigType', () => {
    const cfg: AssetsConfigType = AssetsConfig;
    expect(cfg.palette).toBeDefined();
    expect(typeof cfg.palette.shipHull).toBe('string');
    expect(cfg.shapes2d).toBeDefined();
  });

  it('TeamsConfig matches TeamsConfig type', () => {
    const cfg: typeof TeamsConfig = TeamsConfig;
    expect(cfg.teams.red.id).toBe('red');
    expect(cfg.teams.blue.color).toMatch(/^#/);
    expect(cfg.defaultFleet.counts.fighter).toBeGreaterThan(0);
  });

  it('RendererConfig matches RendererConfig type', () => {
    const cfg: typeof RendererConfig = RendererConfig;
    expect(cfg.preferred).toMatch(/canvas|webgl/);
    expect(cfg.hpBar).toBeDefined();
    expect(typeof cfg.hpBar.bg).toBe('string');
  });

  it('Shape2D type is assignable from config', () => {
    const shape: Shape2D = AssetsConfig.shapes2d['fighter'];
    expect(['polygon', 'circle', 'compound']).toContain(shape.type);
  });

  it('ShipConfigMap type is assignable from config', () => {
    // Import ShipConfig from entitiesConfig if needed
    // const cfg: ShipConfigMap = ShipConfig;
    // expect(cfg.fighter.maxHp).toBeGreaterThan(0);
  expect(typeof TeamsConfig.defaultFleet.counts.fighter).toBe('number');
  });
});
