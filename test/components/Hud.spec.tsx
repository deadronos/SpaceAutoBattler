import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { Hud } from '../../src/components/Hud';
import * as GameContext from '../../src/game/context';
import * as UiStore from '../../src/game/uiStore';
import * as ArchetypeHooks from '../../src/hooks/useArchetypeEntities';

vi.mock('../../src/game/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/game/uiStore', () => ({
  useUiStore: vi.fn(),
}));

vi.mock('../../src/hooks/useArchetypeEntities', () => ({
  useArchetypeEntities: vi.fn(),
}));

// Mock sub-components that might cause issues or aren't relevant to this test
vi.mock('../../src/components/AiDebugOverlay', () => ({
  AiDebugOverlay: () => <div data-testid="ai-debug-overlay" />,
}));
vi.mock('../../src/components/ExplosionDebugOverlay', () => ({
  ExplosionDebugOverlay: () => <div data-testid="explosion-debug-overlay" />,
}));
vi.mock('../../src/components/HudHealthLayer', () => ({
  HudHealthLayer: () => <div data-testid="hud-health-layer" />,
}));
vi.mock('../../src/components/ProgressionPanel', () => ({
  ProgressionPanel: () => <div data-testid="progression-panel" />,
}));
vi.mock('../../src/components/HudToggleDrawer', () => ({
  SettingsDrawer: () => <div data-testid="settings-drawer" />,
  DebugDrawer: () => <div data-testid="debug-drawer" />,
}));
vi.mock('../../src/debug/ErrorCountsPanel.js', () => ({
  ErrorCountsPanel: () => <div data-testid="error-counts-panel" />,
}));

describe('Hud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UiStore.useUiStore as any).mockImplementation((selector: any) => {
      const state = {
        hudHealthBarsEnabled: true,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders progress bars with accessible attributes', () => {
    (GameContext.useOptionalGameState as any).mockReturnValue({
      queries: {
        ships: {},
      },
    }); // non-null state with queries.ships

    // Mock ships
    // Alliance: 1 ship, 50/100 HP
    // Reavers: 1 ship, 25/100 HP
    const mockShips = [
      { ship: { team: 'blue', hp: 50, maxHp: 100, level: 1 } },
      { ship: { team: 'red', hp: 25, maxHp: 100, level: 1 } },
    ];
    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue(mockShips);

    render(<Hud />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);

    // Alliance (Blue)
    expect(progressBars[0].getAttribute('aria-valuenow')).toBe('50');
    expect(progressBars[0].getAttribute('aria-valuemax')).toBe('100');
    expect(progressBars[0].getAttribute('aria-label')).toBe('Alliance hull integrity');

    // Reavers (Red)
    expect(progressBars[1].getAttribute('aria-valuenow')).toBe('25');
    expect(progressBars[1].getAttribute('aria-valuemax')).toBe('100');
    expect(progressBars[1].getAttribute('aria-label')).toBe('Reavers hull integrity');
  });

  it('renders the dev error indicator panel', () => {
    (GameContext.useOptionalGameState as any).mockReturnValue({
      queries: {
        ships: {},
      },
    });
    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue([]);

    render(<Hud />);

    expect(screen.getByTestId('error-counts-panel')).toBeTruthy();
  });
});
