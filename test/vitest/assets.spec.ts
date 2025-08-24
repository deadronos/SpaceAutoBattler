import { describe, it, expect } from 'vitest';
import AssetsConfig, { getShipAsset, getBulletAsset, getTurretAsset, getVisualConfig } from '../../src/config/assets/assetsConfig';

describe('Assets', () => {
  it('should provide ship assets for all types', () => {
    const types = Object.keys(AssetsConfig.shapes2d);
    for (const type of types) {
      const asset = getShipAsset(type);
      expect(asset).toBeDefined();
    }
  });

  it('should provide bullet assets for all kinds', () => {
    expect(getBulletAsset('small')).toBeDefined();
    expect(getBulletAsset('medium')).toBeDefined();
    expect(getBulletAsset('large')).toBeDefined();
  });

  it('should provide turret asset', () => {
    expect(getTurretAsset('basic')).toBeDefined();
  });

  it('should provide visual config for ship type', () => {
    const vconf = getVisualConfig('fighter');
    expect(vconf).toBeDefined();
    expect(vconf.shape).toBeDefined();
    expect(vconf.visuals).toBeDefined();
  });
});
