import { describe, it, expect } from 'vitest';

import * as cameraConfig from '../../../src/config/cameraConfig.js';

describe('cameraConfig', () => {
  it('exports expected fields and defaults', () => {
    expect(typeof cameraConfig).toBe('object');
    // Has DefaultCameraConfig with nested controls and cinematic

    expect(typeof (cameraConfig as any).DefaultCameraConfig).toBe('object');

    expect(typeof (cameraConfig as any).DefaultCameraConfig.controls.mouseSensitivity).toBe(
      'number',
    );
  });
});
