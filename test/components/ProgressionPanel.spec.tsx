import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { ProgressionPanel } from '../../src/components/ProgressionPanel';
import * as GameContext from '../../src/game/context';
import * as UiStore from '../../src/game/uiStore';

// Mock the dependencies
vi.mock('../../src/game/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/game/uiStore', () => ({
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
        progressionPanelPosition: { x: 0, y: 0 },
        setProgressionPanelPosition: mockSetPosition,
      };
      return selector(state);
    });
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
});
