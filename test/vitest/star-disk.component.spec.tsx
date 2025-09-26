import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
  useThree: () => ({
    gl: {
      capabilities: {
        getMaxAnisotropy: () => 1,
      },
    },
    viewport: { aspect: 1 },
    size: { width: 800, height: 600 },
  }),
}));

vi.mock('@react-three/drei', () => ({
  useTexture: () => ({ organic: undefined, noiseRgba: undefined }),
}));

vi.mock('../../src/game/context.js', () => ({
  useOptionalGameState: () => undefined,
}));

vi.mock('../../src/renderer/BloomProvider.js', () => ({
  useBloomRegistration: () => undefined,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StarDisk component', () => {
  it('falls back to mesh basic material when shader creation fails', async () => {
    const starMaterialModule = await import('../../src/renderer/starDiskMaterial.js');
    const createSpy = vi
      .spyOn(starMaterialModule, 'createMainSequenceStarMaterial')
      .mockImplementation(() => {
        throw new Error('shader compile failure');
      });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { StarDisk } = await import('../../src/components/environment/StarDisk.js');

    const config = {
      color: '#ffffff',
      intensity: 1,
      direction: { x: 0, y: 0, z: -1 },
      distance: 1000,
    };

    const { container } = render(
      <StarDisk config={config} enabled={true} size={500} opacity={0.8} distanceMultiplier={1} />,
    );

    expect(container.querySelector('meshbasicmaterial')).not.toBeNull();
    expect(container.querySelector('primitive')).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create main sequence star material'),
      expect.any(Error),
    );

    createSpy.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });
});
