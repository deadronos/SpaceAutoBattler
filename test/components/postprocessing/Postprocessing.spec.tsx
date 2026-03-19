import React from 'react';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vite-plus/test';
import { render, act, cleanup, waitFor } from '@testing-library/react';

const frameCallbacks: Array<(state: unknown, delta: number) => void> = [];
const rendererStub = { renderer: true };
const size = { width: 1024, height: 768 };
const sceneStub = { id: 'scene' };
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
  selections: new Map([['default', bloomSelection]]),
  enabled: true,
  register: vi.fn(),
  unregister: vi.fn(),
};

vi.mock('../../../src/renderer/BloomProvider.js', () => ({
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

describe('Postprocessing component', () => {
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
    bloomSelection.size = 1;
  });

  afterEach(() => {
    cleanup();
  });

  it('wires composer lifecycle when enabled', async () => {
    const { rerender } = render(<Postprocessing enabled />);

    await waitFor(() => {
      expect(buildEffectsMock).toHaveBeenCalledTimes(1);
      expect(createComposerMock).toHaveBeenCalledTimes(1);
    });

    expect(createComposerMock).toHaveBeenCalledWith({
      renderer: rendererStub,
      scene: sceneStub,
      camera: cameraStub,
      effectPass: effectPassStub,
    });

    expect(frameCallbacks).toHaveLength(1);
    expect(renderTargetSetSize).toHaveBeenCalledWith(1024, 768);
    expect(composerSetSize).toHaveBeenCalledWith(1024, 768);

    await act(async () => {
      frameCallbacks[0]({}, 0.016);
    });

    expect(bloomEffect.blendMode.opacity.value).toBe(1);

    bloomSelection.size = 0;
    await act(async () => {
      frameCallbacks[0]({}, 0.016);
    });
    expect(bloomEffect.blendMode.opacity.value).toBe(0);

    rerender(<Postprocessing enabled={false} />);

    await waitFor(() => {
      expect(composerDispose).toHaveBeenCalledTimes(1);
      expect(renderTargetDispose).toHaveBeenCalledTimes(1);
      expect(restoreRendererState).toHaveBeenCalledTimes(1);
    });

    expect(buildEffectsMock).toHaveBeenCalledTimes(1);
  });

  it('skips setup when disabled initially', async () => {
    render(<Postprocessing enabled={false} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildEffectsMock).not.toHaveBeenCalled();
    expect(createComposerMock).not.toHaveBeenCalled();
  });
});
