import { describe, it, expect } from 'vitest';
import { validateAssetsConfig, validateRendererConfig } from '../../src/config/validateConfig.js';
import AssetsConfig from '../../src/config/assets/assetsConfig.js';
import RendererConfig from '../../src/config/rendererConfig.js';

describe('assets and renderer config validation', () => {
  it('assets config passes basic validation', () => {
    const errs = validateAssetsConfig(AssetsConfig as any);
    expect(errs.length).toBe(0);
  });

  it('renderer config passes basic validation', () => {
    const errs = validateRendererConfig(RendererConfig as any);
    expect(errs.length).toBe(0);
  });
});
