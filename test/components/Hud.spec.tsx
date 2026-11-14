import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Hud } from '../../src/components/Hud';
import * as GameContext from '../../src/app/context';
import * as UiStore from '../../src/app/uiStore';
import * as ArchetypeHooks from '../../src/hooks/useArchetypeEntities';

vi.mock('../../src/app/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/app/uiStore', () => ({
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
  const setCameraFollowEnabled = vi.fn();
  const selectShip = vi.fn();
  let mockUiState: {
    hudHealthBarsEnabled: boolean;
    selectedShipId: number | null;
    cameraFollowEnabled: boolean;
    paused: boolean;
    timeScale: number;
    setCameraFollowEnabled: typeof setCameraFollowEnabled;
    selectShip: typeof selectShip;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUiState = {
      hudHealthBarsEnabled: true,
      selectedShipId: null,
      cameraFollowEnabled: false,
      paused: false,
      timeScale: 1,
      setCameraFollowEnabled,
      selectShip,
    };
    (UiStore.useUiStore as any).mockImplementation((selector: any) =>
      selector ? selector(mockUiState) : mockUiState,
    );
  });

  afterEach(() => {
    cleanup();
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
      { id: 1, ship: { team: 'blue', hull: 'fighter', hp: 50, maxHp: 100, level: 1 } },
      { id: 2, ship: { team: 'red', hull: 'corvette', hp: 25, maxHp: 100, level: 1 } },
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

  it('renders live battle telemetry in the subtitle', () => {
    (GameContext.useOptionalGameState as any).mockReturnValue({
      queries: {
        ships: {},
      },
    });
    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue([
      { id: 1, ship: { team: 'blue', hull: 'fighter', hp: 50, maxHp: 100, level: 1 } },
      { id: 2, ship: { team: 'red', hull: 'corvette', hp: 25, maxHp: 100, level: 1 } },
    ]);

    const { rerender } = render(<Hud />);
    expect(screen.getByText('2 ships · Battle active')).toBeTruthy();

    mockUiState.timeScale = 2;
    rerender(<Hud />);
    expect(screen.getByText('2 ships · Battle active · 2x')).toBeTruthy();

    mockUiState.paused = true;
    rerender(<Hud />);
    expect(screen.getByText('2 ships · Paused')).toBeTruthy();

    mockUiState.paused = false;
    mockUiState.timeScale = 1;
    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue([
      { id: 1, ship: { team: 'blue', hull: 'fighter', hp: 50, maxHp: 100, level: 1 } },
    ]);
    rerender(<Hud />);
    expect(screen.getByText('1 ship · Alliance victory')).toBeTruthy();

    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue([]);
    rerender(<Hud />);
    expect(screen.getByText('0 ships · Standby')).toBeTruthy();
  });

  it('renders inline Follow/Unfollow and Clear actions for the selected ship', () => {
    (GameContext.useOptionalGameState as any).mockReturnValue({
      queries: {
        ships: {},
      },
    });
    (ArchetypeHooks.useArchetypeEntities as any).mockReturnValue([
      { id: 42, ship: { team: 'blue', hull: 'frigate', hp: 100, maxHp: 100, level: 1 } },
      { id: 99, ship: { team: 'red', hull: 'fighter', hp: 80, maxHp: 80, level: 1 } },
    ]);

    const { rerender } = render(<Hud />);
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    mockUiState.selectedShipId = 42;
    rerender(<Hud />);

    expect(screen.getByText('Selected ship #42 (Alliance frigate)')).toBeTruthy();
    const followButton = screen.getByRole('button', { name: 'Follow' });
    expect(followButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(followButton);
    expect(setCameraFollowEnabled).toHaveBeenCalledWith(true);

    mockUiState.cameraFollowEnabled = true;
    rerender(<Hud />);
    const unfollowButton = screen.getByRole('button', { name: 'Unfollow' });
    expect(unfollowButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(unfollowButton);
    expect(setCameraFollowEnabled).toHaveBeenCalledWith(false);

    const clearButton = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(clearButton);
    expect(selectShip).toHaveBeenCalledWith(null);
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
