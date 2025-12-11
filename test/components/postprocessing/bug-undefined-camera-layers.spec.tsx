import React from 'react';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';

const frameCallbacks: Array<(state: unknown, delta: number) => void> = [];
const rendererStub = { renderer: true };
const size = { width: 1024, height: 768 };
const sceneStub = { id: 'scene' };
// CRITICAL: cameraStub is missing 'layers' property, which triggers the bug
const cameraStub = { id: 'camera' };

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    gl: rendererStub,
    scene: sceneStub,
    camera: cameraStub,
    size,
  }),
  useFrame: (fn: (state: unknown, delta: number) => void) => {
    frameCallbacks.push(fn);
  },
}));

const bloomSelection = { size: 1 } as { size: number };
const bloomContextValue = {
  defaultGroup: 'default',
  selections: new Map([["default", bloomSelection]]),
  enabled: true,
  register: vi.fn(),
  unregister: vi.fn(),
  // Add enableCameraLayers to simulate real behavior
  enableCameraLayers: vi.fn(() => 0),
};

// Mocking the index where useBloomContext is exported from
vi.mock('../../../src/renderer/bloom/index.js', () => ({
  useBloomContext: () => bloomContextValue,
}));

const composerRender = vi.fn();
const composerSetSize = vi.fn();
const composerDispose = vi.fn();
const restoreRendererState = vi.fn();
const renderTargetSetSize = vi.fn();
const renderTargetDispose = vi.fn();

const bloomEffect = {
  selection: bloomSelection,
  blendMode: { opacity: { value: 0 } },
};

const fxaaEffect = { id: 'fxaa' };
const effectPassStub = { id: 'effectPass' };

const createComposerMock = vi.fn(() => ({
  composer: {
    render: composerRender,
    dispose: composerDispose,
    setSize: composerSetSize,
  },
  renderTarget: {
    setSize: renderTargetSetSize,
    dispose: renderTargetDispose,
  },
  dispose: () => {
    composerDispose();
    renderTargetDispose();
  },
  restoreRendererState,
}));

const buildEffectsMock = vi.fn(() => ({
  effectPass: effectPassStub,
  bloomEffects: [bloomEffect],
  fxaa: fxaaEffect,
  effects: [bloomEffect, fxaaEffect],
}));

vi.mock('../../../src/components/postprocessing/createComposer.js', () => ({
  createComposer: (...args: unknown[]) => createComposerMock(...args),
}));

vi.mock('../../../src/components/postprocessing/buildEffects.js', () => ({
  buildEffects: (...args: unknown[]) => buildEffectsMock(...args),
}));

import { Postprocessing } from '../../../src/components/Postprocessing.js';

describe('Bug Reproduction: Postprocessing render', () => {
  beforeEach(() => {
    frameCallbacks.length = 0;
    composerRender.mockClear();
    composerSetSize.mockClear();
    composerDispose.mockClear();
    restoreRendererState.mockClear();
    renderTargetSetSize.mockClear();
    renderTargetDispose.mockClear();
    buildEffectsMock.mockClear();
    createComposerMock.mockClear();
    bloomContextValue.enableCameraLayers.mockClear();
    bloomSelection.size = 1;
  });

  afterEach(() => {
    cleanup();
  });

  it('calls composer.render in loop even if camera.layers is missing', async () => {
    render(<Postprocessing enabled />);

    await waitFor(() => {
        expect(createComposerMock).toHaveBeenCalled();
    });

    await act(async () => {
      // Simulate a frame
      frameCallbacks[0]({}, 0.016);
    });

    // The bug causes composerRender to NOT be called because of the exception.
    expect(composerRender).toHaveBeenCalledWith(0.016);
    // Also verify enableCameraLayers was called (since we added it)
    expect(bloomContextValue.enableCameraLayers).toHaveBeenCalled();
  });
});
