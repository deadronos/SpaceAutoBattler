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

vi.mock('../../../src/renderer/bloom/BloomProvider.js', () => ({
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

const aoPassDispose = vi.fn();
const aoPassStub = { id: 'aoPass', dispose: aoPassDispose };

const buildAmbientOcclusionMock = vi.fn(() => aoPassStub);

vi.mock('../../../src/components/postprocessing/buildAmbientOcclusion.js', () => ({
  buildAmbientOcclusion: (...args: unknown[]) => buildAmbientOcclusionMock(...args),
}));

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
import { POSTPROCESSING_CONFIG } from '../../../src/config/renderer.js';

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
    buildAmbientOcclusionMock.mockClear();
    aoPassDispose.mockClear();
    bloomSelection.size = 1;
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as { __copilot_forceHdrPipeline?: boolean })
      .__copilot_forceHdrPipeline;
    delete (window as unknown as { __copilot_forceAmbientOcclusion?: boolean })
      .__copilot_forceAmbientOcclusion;
  });

  it('wires composer lifecycle when enabled', async () => {
    const { rerender } = render(<Postprocessing enabled />);

    await waitFor(() => {
      expect(buildEffectsMock).toHaveBeenCalledTimes(1);
      expect(createComposerMock).toHaveBeenCalledTimes(1);
    });

    const expectedColorPipeline = {
      ...POSTPROCESSING_CONFIG.colorPipeline,
      enabled: POSTPROCESSING_CONFIG.colorPipeline.enabled,
    };

    expect(buildEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ colorPipeline: expectedColorPipeline }),
    );

    expect(createComposerMock).toHaveBeenCalledWith({
      renderer: rendererStub,
      scene: sceneStub,
      camera: cameraStub,
      effectPass: effectPassStub,
      colorPipeline: expectedColorPipeline,
      aoPass: aoPassStub,
    });

    expect(buildAmbientOcclusionMock).toHaveBeenCalledTimes(1);
    expect(buildAmbientOcclusionMock).toHaveBeenCalledWith({
      scene: sceneStub,
      camera: cameraStub,
      width: size.width,
      height: size.height,
      config: POSTPROCESSING_CONFIG.ao,
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

    expect(aoPassDispose).toHaveBeenCalledTimes(1);
    expect(buildEffectsMock).toHaveBeenCalledTimes(1);
  });

  it('skips setup when disabled initially', async () => {
    render(<Postprocessing enabled={false} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildEffectsMock).not.toHaveBeenCalled();
    expect(createComposerMock).not.toHaveBeenCalled();
    expect(buildAmbientOcclusionMock).not.toHaveBeenCalled();
  });

  it('disposes the AO pass when composer creation throws', async () => {
    createComposerMock.mockImplementationOnce(() => {
      throw new Error('composer construction failed');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(<Postprocessing enabled />);

      await waitFor(() => {
        expect(createComposerMock).toHaveBeenCalledTimes(1);
      });

      // The pass was built but never handed to the composer, so it must be
      // released by the error path.
      expect(aoPassDispose).toHaveBeenCalledTimes(1);
      expect(composerDispose).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('forces the legacy pipeline when __copilot_forceHdrPipeline is false', async () => {
    (window as unknown as { __copilot_forceHdrPipeline?: boolean }).__copilot_forceHdrPipeline =
      false;

    render(<Postprocessing enabled />);

    await waitFor(() => {
      expect(createComposerMock).toHaveBeenCalledTimes(1);
    });

    const expectedLegacy = {
      ...POSTPROCESSING_CONFIG.colorPipeline,
      enabled: false,
    };

    expect(buildEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ colorPipeline: expectedLegacy }),
    );
    expect(createComposerMock).toHaveBeenCalledWith(
      expect.objectContaining({ colorPipeline: expectedLegacy }),
    );
  });
});
