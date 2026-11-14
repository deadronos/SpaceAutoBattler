import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ShipHudOverlay } from '../../src/components/ShipHudOverlay.js';
import type { OverlayLayoutResult } from '../../src/components/HudHealthLayer.js';
import { DEFAULT_HUD_HEALTH_OVERLAY_CONFIG } from '../../src/config/hudHealth.js';

const { reducedMotionState } = vi.hoisted(() => ({
  reducedMotionState: { value: false },
}));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}));

function makeOverlay(overrides: Partial<OverlayLayoutResult> = {}): OverlayLayoutResult {
  return {
    id: 1,
    team: 'blue',
    hull: 'fighter',
    ratios: { health: 1, shield: 1 },
    screen: { x: 400, y: 300, hidden: false },
    seed: 1337,
    effects: [],
    overflowCount: 0,
    ...overrides,
  };
}

function getFillWidths(container: HTMLElement): { shield: number; health: number } {
  const shieldFill = container.querySelector(
    '.ship-hud-overlay__bar--shield .ship-hud-overlay__fill',
  ) as HTMLElement | null;
  const healthFill = container.querySelector(
    '.ship-hud-overlay__bar--health .ship-hud-overlay__fill',
  ) as HTMLElement | null;
  return {
    shield: Number.parseInt(shieldFill?.style.width ?? '0', 10),
    health: Number.parseInt(healthFill?.style.width ?? '0', 10),
  };
}

describe('ShipHudOverlay bar width updates', () => {
  beforeEach(() => {
    reducedMotionState.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('smoothly updates fill widths in JS and converges to the target width', () => {
    vi.useFakeTimers();
    const initial = makeOverlay({ ratios: { health: 1, shield: 1 } });
    const { container, rerender, getByRole } = render(
      <ShipHudOverlay overlay={initial} config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG} />,
    );

    expect(getFillWidths(container)).toEqual({ shield: 40, health: 40 });

    const damaged = makeOverlay({ ratios: { health: 0.25, shield: 0.5 } });
    rerender(<ShipHudOverlay overlay={damaged} config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG} />);

    // Advances one animation frame: bar should step partway toward target rather than jumping or staying stuck.
    act(() => {
      vi.advanceTimersByTime(16);
    });
    const afterOneFrame = getFillWidths(container);
    expect(afterOneFrame.health).toBeLessThan(40);
    expect(afterOneFrame.health).toBeGreaterThan(10);
    expect(afterOneFrame.shield).toBeLessThan(40);
    expect(afterOneFrame.shield).toBeGreaterThan(20);

    // Advances remaining frames: bar must converge cleanly to exact target widths.
    for (let i = 0; i < 25; i += 1) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }
    expect(getFillWidths(container)).toEqual({ shield: 20, health: 10 });
    expect(getByRole('group').getAttribute('aria-label')).toBe(
      'fighter hull 25% integrity, shields 50%',
    );
  });

  it('updates fill widths immediately when reduced motion is enabled', () => {
    reducedMotionState.value = true;
    const initial = makeOverlay({ ratios: { health: 1, shield: 0.8 } });
    const { container, rerender, getByRole } = render(
      <ShipHudOverlay overlay={initial} config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG} />,
    );

    expect(getFillWidths(container)).toEqual({ shield: 32, health: 40 });

    const updated = makeOverlay({ ratios: { health: 0.25, shield: 0.25 } });
    rerender(<ShipHudOverlay overlay={updated} config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG} />);

    expect(getFillWidths(container)).toEqual({ shield: 10, health: 10 });
    expect(getByRole('group').getAttribute('aria-label')).toBe(
      'fighter hull 25% integrity, shields 25%',
    );
  });

  it('renders disabled shield bar with zero width when shield ratio is NaN', () => {
    const overlay = makeOverlay({ ratios: { health: 0.6, shield: Number.NaN } });
    const { container, getByRole } = render(
      <ShipHudOverlay overlay={overlay} config={DEFAULT_HUD_HEALTH_OVERLAY_CONFIG} />,
    );

    const shieldBar = container.querySelector('.ship-hud-overlay__bar--shield');
    expect(shieldBar?.classList.contains('ship-hud-overlay__bar--disabled')).toBe(true);
    expect(getFillWidths(container)).toEqual({ shield: 0, health: 24 });
    expect(getByRole('group').getAttribute('aria-label')).toBe('fighter hull 60% integrity');
  });
});
