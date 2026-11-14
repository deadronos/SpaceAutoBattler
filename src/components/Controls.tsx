import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { useOptionalGameState } from '../app/context.js';
import { useUiStore } from '../app/uiStore.js';
import { requestReset, spawnRandomShip } from '../game/state.js';
import { useTimeout } from '../hooks/useTimeout.js';

const TIME_SCALE_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4] as const;

const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable]';
const INTERACTIVE_SPACE_TARGET_SELECTOR =
  'button, a[href], summary, [role="button"], [role="switch"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="tab"], [role="slider"], [role="combobox"]';

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest(EDITABLE_TARGET_SELECTOR) !== null;
}

function isInteractiveSpaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(INTERACTIVE_SPACE_TARGET_SELECTOR) !== null;
}

function stepTimeScale(current: number, direction: -1 | 1): number {
  if (direction < 0) {
    for (let i = TIME_SCALE_OPTIONS.length - 1; i >= 0; i--) {
      const candidate = TIME_SCALE_OPTIONS[i];
      if (candidate !== undefined && candidate < current) return candidate;
    }
    return TIME_SCALE_OPTIONS[0];
  }
  for (const candidate of TIME_SCALE_OPTIONS) {
    if (candidate > current) return candidate;
  }
  return TIME_SCALE_OPTIONS[TIME_SCALE_OPTIONS.length - 1] ?? current;
}

/**
 * UI component rendering the top-level controls bar (Pause, Reset, Spawn).
 *
 * @returns {React.ReactElement} The rendered controls bar.
 */
export function Controls(): React.ReactElement {
  const state = useOptionalGameState();
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const togglePause = useUiStore((s) => s.togglePause);
  const setTimeScale = useUiStore((s) => s.setTimeScale);
  const [resetConfirm, setResetConfirm] = useState(false);

  useTimeout(() => setResetConfirm(false), resetConfirm ? 3000 : null);

  const addShip = (team: 'red' | 'blue') => {
    if (!state) return;
    spawnRandomShip(state, team);
  };

  const handleReset = useCallback(() => {
    if (!state) return;
    if (resetConfirm) {
      requestReset(state);
      setResetConfirm(false);
    } else {
      setResetConfirm(true);
    }
  }, [state, resetConfirm]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableEventTarget(event.target)) return;

      if (event.code === 'Space' || event.key === ' ') {
        if (event.shiftKey || isInteractiveSpaceTarget(event.target)) return;
        event.preventDefault();
        togglePause();
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleReset();
        return;
      }

      if (event.key === '[' || event.key === ']') {
        const direction = event.key === '[' ? -1 : 1;
        const nextScale = stepTimeScale(timeScale, direction);
        event.preventDefault();
        if (nextScale !== timeScale) {
          setTimeScale(nextScale);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePause, handleReset, setTimeScale, timeScale]);

  return (
    <div className="controls-bar" role="toolbar" aria-label="Simulation controls">
      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
        title={paused ? 'Resume simulation (Space)' : 'Pause simulation (Space)'}
        aria-keyshortcuts="Space"
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        onClick={handleReset}
        aria-label="Reset simulation"
        title={resetConfirm ? 'Confirm reset simulation (R)' : 'Reset simulation (R)'}
        aria-keyshortcuts="R"
      >
        {resetConfirm ? 'Confirm?' : 'Reset'}
      </button>
      <button
        type="button"
        onClick={() => addShip('red')}
        aria-label="Spawn Red ship"
        title="Spawn Red ship"
      >
        + Red
      </button>
      <button
        type="button"
        onClick={() => addShip('blue')}
        aria-label="Spawn Blue ship"
        title="Spawn Blue ship"
      >
        + Blue
      </button>
      {/* Simulation modifiers moved to HUD settings */}
      <div className="speed">
        <label htmlFor="speedSelect">Speed:</label>
        <select
          id="speedSelect"
          aria-label="Simulation speed"
          title="Simulation speed ([ slower, ] faster)"
          aria-keyshortcuts="[ ]"
          value={String(timeScale)}
          onChange={(e) => setTimeScale(parseFloat(e.target.value))}
        >
          {TIME_SCALE_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {option}x
            </option>
          ))}
        </select>
      </div>
      {/* PP tuning sliders removed per request; toggles live in HUD drawers */}
    </div>
  );
}
