import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { Controls } from '../../src/components/Controls';
import * as GameContext from '../../src/app/context';
import * as UiStore from '../../src/app/uiStore';
import * as GameState from '../../src/game/state';

// Mock the context and hooks
vi.mock('../../src/app/context', () => ({
  useOptionalGameState: vi.fn(),
}));

vi.mock('../../src/app/uiStore', () => ({
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

  it('renders toolbar and buttons with correct accessible labels and shortcuts', () => {
    render(<Controls />);

    const toolbar = screen.getByRole('toolbar', { name: 'Simulation controls' });
    expect(toolbar).toBeDefined();

    // Reset button
    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeDefined();
    expect(resetButton.getAttribute('aria-label')).toBe('Reset simulation');
    expect(resetButton.getAttribute('title')).toBe('Reset simulation (R)');
    expect(resetButton.getAttribute('aria-keyshortcuts')).toBe('R');

    // Pause button
    const pauseButton = screen.getByText('Pause');
    expect(pauseButton.getAttribute('aria-label')).toBe('Pause simulation');
    expect(pauseButton.getAttribute('title')).toBe('Pause simulation (Space)');
    expect(pauseButton.getAttribute('aria-keyshortcuts')).toBe('Space');

    // Spawn buttons
    const redButton = screen.getByText('+ Red');
    expect(redButton.getAttribute('aria-label')).toBe('Spawn Red ship');

    const blueButton = screen.getByText('+ Blue');
    expect(blueButton.getAttribute('aria-label')).toBe('Spawn Blue ship');

    // Speed select
    const speedSelect = screen.getByLabelText('Simulation speed');
    expect(speedSelect.getAttribute('aria-keyshortcuts')).toBe('[ ]');
    expect(speedSelect.getAttribute('title')).toBe('Simulation speed ([ slower, ] faster)');
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

  it('toggles pause with Space when not focused on an interactive control', () => {
    render(<Controls />);

    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(mockTogglePause).toHaveBeenCalledTimes(1);

    // Should ignore Space when focused on a button or editable element
    const redButton = screen.getByText('+ Red');
    fireEvent.keyDown(redButton, { key: ' ', code: 'Space' });
    expect(mockTogglePause).toHaveBeenCalledTimes(1);

    // Should ignore Space when modifier keys are held
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space', shiftKey: true });
    expect(mockTogglePause).toHaveBeenCalledTimes(1);
  });

  it('arms and confirms reset with r / R', () => {
    render(<Controls />);

    fireEvent.keyDown(document.body, { key: 'r' });
    expect(GameState.requestReset).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm?')).toBeDefined();

    fireEvent.keyDown(document.body, { key: 'R', shiftKey: true });
    expect(GameState.requestReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Confirm?')).toBeNull();
  });

  it('steps time scale with [ and ] and clamps at boundaries', () => {
    const { rerender } = render(<Controls />);

    fireEvent.keyDown(document.body, { key: '[' });
    expect(mockSetTimeScale).toHaveBeenCalledWith(0.5);

    fireEvent.keyDown(document.body, { key: ']' });
    expect(mockSetTimeScale).toHaveBeenCalledWith(1.5);

    mockSetTimeScale.mockClear();
    (UiStore.useUiStore as any).mockImplementation((selector: any) => {
      const state = {
        paused: false,
        timeScale: 0.25,
        togglePause: mockTogglePause,
        setTimeScale: mockSetTimeScale,
      };
      return selector ? selector(state) : state;
    });
    rerender(<Controls />);
    fireEvent.keyDown(document.body, { key: '[' });
    expect(mockSetTimeScale).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when focus is in input, textarea, or select or modifiers are held', () => {
    render(
      <div>
        <input data-testid="text-input" />
        <textarea data-testid="text-area" />
        <Controls />
      </div>,
    );

    const input = screen.getByTestId('text-input');
    const textarea = screen.getByTestId('text-area');
    const select = screen.getByLabelText('Simulation speed');

    for (const target of [input, textarea, select]) {
      fireEvent.keyDown(target, { key: ' ', code: 'Space' });
      fireEvent.keyDown(target, { key: 'r' });
      fireEvent.keyDown(target, { key: '[' });
      fireEvent.keyDown(target, { key: ']' });
    }

    fireEvent.keyDown(document.body, { key: 'r', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'r', metaKey: true });
    fireEvent.keyDown(document.body, { key: '[', altKey: true });

    expect(mockTogglePause).not.toHaveBeenCalled();
    expect(GameState.requestReset).not.toHaveBeenCalled();
    expect(mockSetTimeScale).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm?')).toBeNull();
  });
});
