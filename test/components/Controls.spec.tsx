import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { Controls } from '../../src/components/Controls';
import * as GameContext from '../../src/game/context';
import * as UiStore from '../../src/game/uiStore';
import * as GameState from '../../src/game/state';

// Mock the context and hooks
vi.mock('../../src/game/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/game/uiStore', () => ({
  useUiStore: vi.fn(),
}));

vi.mock('../../src/game/state', () => ({
  requestReset: vi.fn(),
  spawnRandomShip: vi.fn(),
}));

describe('Controls', () => {
  const mockTogglePause = vi.fn();
  const mockSetTimeScale = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (GameContext.useOptionalGameState as any).mockReturnValue({}); // Non-null state
    (UiStore.useUiStore as any).mockImplementation((selector: any) => {
      const state = {
        paused: false,
        timeScale: 1,
        togglePause: mockTogglePause,
        setTimeScale: mockSetTimeScale,
      };
      return selector ? selector(state) : state;
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders buttons with correct accessible labels', () => {
    render(<Controls />);

    // Reset button
    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeDefined();
    // Expect ARIA label to be present (fails initially)
    expect(resetButton.getAttribute('aria-label')).toBe('Reset simulation');
    expect(resetButton.getAttribute('title')).toBe('Reset simulation');

    // Pause button
    const pauseButton = screen.getByText('Pause');
    expect(pauseButton.getAttribute('aria-label')).toBe('Pause simulation');
    expect(pauseButton.getAttribute('title')).toBe('Pause simulation');

    // Spawn buttons
    const redButton = screen.getByText('+ Red');
    expect(redButton.getAttribute('aria-label')).toBe('Spawn Red ship');

    const blueButton = screen.getByText('+ Blue');
    expect(blueButton.getAttribute('aria-label')).toBe('Spawn Blue ship');
  });

  it('requires confirmation to reset', () => {
    render(<Controls />);

    const resetButton = screen.getByText('Reset');

    // First click: should NOT call requestReset
    fireEvent.click(resetButton);
    expect(GameState.requestReset).not.toHaveBeenCalled();

    // Text should change to "Confirm?"
    // This will fail initially because the text doesn't change
    const confirmButton = screen.getByText('Confirm?');
    expect(confirmButton).toBeDefined();

    // Second click: should call requestReset
    fireEvent.click(confirmButton);
    expect(GameState.requestReset).toHaveBeenCalled();

    // Should revert to "Reset" immediately after action
    expect(screen.queryByText('Confirm?')).toBeNull();
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('reverts reset confirmation after timeout', () => {
    render(<Controls />);

    const resetButton = screen.getByText('Reset');

    // First click
    fireEvent.click(resetButton);
    // This will fail
    // expect(screen.getByText('Confirm?')).toBeDefined();

    // Advance time by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should revert to "Reset"
    expect(screen.queryByText('Confirm?')).toBeNull();
    expect(screen.getByText('Reset')).toBeDefined();
  });
});
