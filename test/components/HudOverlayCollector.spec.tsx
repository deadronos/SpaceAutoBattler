import { cleanup, render } from '@testing-library/react';
import { PerspectiveCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useUiStore } from '../../src/app/uiStore.js';
import { HudOverlayCollector } from '../../src/components/HudOverlayCollector.js';
import { useHudOverlayStore } from '../../src/renderer/hudOverlayStore.js';

const { game, frames } = vi.hoisted(() => ({
  game: { queries: { ships: { entities: [] as unknown[] } } },
  frames: { current: undefined as ((frame: object) => void) | undefined },
}));

vi.mock('../../src/app/context.js', () => ({
  useGameState: () => game,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (frame: object) => void) => {
    frames.current = callback;
  },
}));

afterEach(() => {
  cleanup();
  frames.current = undefined;
  game.queries.ships.entities.length = 0;
  useUiStore.setState({ hudHealthBarsEnabled: false });
});

describe('HUD overlay collector', () => {
  it('samples across frames and immediately resumes after re-enabling', () => {
    game.queries.ships.entities.push({
      id: 5,
      transform: { position: new Vector3(0, 0, -5) },
      ship: { team: 'blue', hull: 'fighter', hp: 100, maxHp: 100, shield: 0, maxShield: 100 },
    });
    useUiStore.setState({ hudHealthBarsEnabled: true });
    render(<HudOverlayCollector />);

    const camera = new PerspectiveCamera();
    const size = { width: 200, height: 100 };
    const frame = (elapsedTime: number) =>
      frames.current?.({ camera, size, clock: { elapsedTime } });

    frame(0);
    const initial = useHudOverlayStore.getState();
    expect(initial.overlays[0]?.statusEffects).toEqual(['shield-down']);

    frame(1 / 60);
    expect(useHudOverlayStore.getState().frame).toBe(initial.frame);

    frame(1 / 30);
    expect(useHudOverlayStore.getState().frame).toBe(initial.frame + 1);

    useUiStore.setState({ hudHealthBarsEnabled: false });
    frame(0.04);
    expect(useHudOverlayStore.getState().overlays).toHaveLength(0);

    useUiStore.setState({ hudHealthBarsEnabled: true });
    frame(0.04);
    expect(useHudOverlayStore.getState().overlays).toHaveLength(1);
  });
});
