import { describe, expect, it } from 'vite-plus/test';
import {
  SKYSPHERE_HIGHRES_TEXTURE_PATHS,
  selectSkysphereHighResUrl,
} from '../../src/assets/skysphere.js';
import { QUALITY_PRESETS } from '../../src/config/quality.js';

const variants = SKYSPHERE_HIGHRES_TEXTURE_PATHS.richBlueNebulae;

describe('selectSkysphereHighResUrl', () => {
  it('picks the largest variant within the tier budget', () => {
    expect(selectSkysphereHighResUrl('richBlueNebulae', 8192, 16384)).toBe(variants[8192]);
    expect(selectSkysphereHighResUrl('richBlueNebulae', 4096, 16384)).toBe(variants[4096]);
  });

  it('never exceeds the GPU max texture size', () => {
    expect(selectSkysphereHighResUrl('richBlueNebulae', 8192, 4096)).toBe(variants[4096]);
  });

  it('skips the high-res upgrade when no variant fits above the low-res texture', () => {
    expect(selectSkysphereHighResUrl('richBlueNebulae', 2048, 16384)).toBeNull();
    expect(selectSkysphereHighResUrl('richBlueNebulae', 8192, 2048)).toBeNull();
  });

  it('treats an unknown GPU limit as unconstrained', () => {
    expect(selectSkysphereHighResUrl('richBlueNebulae', 8192, undefined)).toBe(variants[8192]);
  });

  it('gives each quality tier a distinct skysphere budget', () => {
    expect(QUALITY_PRESETS.high.skysphereMaxSize).toBe(8192);
    expect(QUALITY_PRESETS.medium.skysphereMaxSize).toBe(4096);
    expect(QUALITY_PRESETS.low.skysphereMaxSize).toBe(2048);
  });
});
