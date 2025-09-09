import { describe, it, expect } from 'vitest';

import * as cameraConfig from '../../../src/config/cameraConfig';

describe('cameraConfig', () => {
  it('exports expected fields and defaults', () => {
    expect(typeof cameraConfig).toBe('object');
  // Has DefaultCameraConfig with nested controls and cinematic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(typeof (cameraConfig as any).DefaultCameraConfig).toBe('object');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(typeof (cameraConfig as any).DefaultCameraConfig.controls.mouseSensitivity).toBe('number');
  });
});
