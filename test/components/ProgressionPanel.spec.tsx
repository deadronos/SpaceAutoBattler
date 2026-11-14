import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { ProgressionPanel } from '../../src/components/ProgressionPanel';
import * as GameContext from '../../src/app/context';
import * as UiStore from '../../src/app/uiStore';

// Mock the dependencies
vi.mock('../../src/app/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/app/uiStore', () => ({
  useUiStore: vi.fn(),
}));

describe('ProgressionPanel', () => {
  const mockSetPosition = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useUiStore
    (UiStore.useUiStore as any).mockImplementation((selector: any) => {
      const state = {
        progressionPanelEnabled: true,
        progressionPanelPosition: { x: 436, y: 272 },
        setProgressionPanelPosition: mockSetPosition,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('displays XP with decimal precision', () => {
    // Mock game state with a ship having fractional XP
    const mockShip = {
      id: 1,
      ship: {
        hull: 'TestHull',
        team: 'blue',
        level: 1,
        xp: 0.5,
        xpToNext: 100.0,
      },
    };

    const mockState = {
      queries: {
        ships: {
          entities: [mockShip],
        },
      },
      progressionEvents: new Map(),
    };

    (GameContext.useOptionalGameState as any).mockReturnValue(mockState);

    render(<ProgressionPanel />);

    // Check for decimal precision in XP display
    // The current implementation uses toFixed(0), so this test should fail initially
    // expecting "1 / 100 XP" or "0 / 100 XP" instead of "0.5 / 100.0 XP"
    const xpText = screen.getByText(/0\.5 \/ 100\.0 XP/);
    expect(xpText).toBeTruthy();
  });

  it('displays event delta XP with decimal precision', async () => {
    // Mock game state with a ship having an event with fractional XP
    const mockEvent = {
      type: 'damage',
      ts: Date.now(),
      deltaXp: 0.5,
      source: 'Test Source',
    };

    const mockShip = {
      id: 1,
      ship: {
        hull: 'TestHull',
        team: 'blue',
        level: 1,
        xp: 0.5,
        xpToNext: 100.0,
      },
    };

    const mockState = {
      queries: {
        ships: {
          entities: [mockShip],
        },
      },
      progressionEvents: new Map([[1, [mockEvent]]]),
    };

    (GameContext.useOptionalGameState as any).mockReturnValue(mockState);

    render(<ProgressionPanel />);

    // Expand the ship card to see events
    const toggleButton = screen.getByRole('button', { name: /Expand events/i });
    fireEvent.click(toggleButton);

    // Check for decimal precision in event delta XP
    // The current implementation uses toFixed(0), so this test should fail initially
    const deltaText = await screen.findByText(/\+0\.5 XP/);
    expect(deltaText).toBeTruthy();
  });

  it('renders a helpful empty state when enabled with zero ships and omits aria-live', () => {
    (GameContext.useOptionalGameState as any).mockReturnValue({
      queries: {
        ships: {
          entities: [],
        },
      },
      progressionEvents: new Map(),
    });

    render(<ProgressionPanel />);

    const region = screen.getByRole('region', { name: 'Ship progression' });
    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-live')).toBeNull();
    expect(screen.getByText('0 ships tracked')).toBeTruthy();
    expect(screen.getByText(/No active ships to track yet/i)).toBeTruthy();
  });

  it('renders nothing when disabled', () => {
    (UiStore.useUiStore as any).mockImplementation((selector: any) => {
      const state = {
        progressionPanelEnabled: false,
        progressionPanelPosition: { x: 436, y: 272 },
        setProgressionPanelPosition: mockSetPosition,
      };
      return selector(state);
    });
    (GameContext.useOptionalGameState as any).mockReturnValue(null);

    const { container } = render(<ProgressionPanel />);
    expect(container.firstChild).toBeNull();
  });
});
