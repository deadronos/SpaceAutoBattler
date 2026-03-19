import { useState, useEffect } from 'react';
import type React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { requestReset, spawnRandomShip } from '../game/state.js';

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

  useEffect(() => {
    if (resetConfirm) {
      const timer = setTimeout(() => setResetConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [resetConfirm]);

  const addShip = (team: 'red' | 'blue') => {
    if (!state) return;
    spawnRandomShip(state, team);
  };

  const handleReset = () => {
    if (!state) return;
    if (resetConfirm) {
      requestReset(state);
      setResetConfirm(false);
    } else {
      setResetConfirm(true);
    }
  };

  return (
    <div className="controls-bar">
      <button
        onClick={togglePause}
        aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
        title={paused ? 'Resume simulation' : 'Pause simulation'}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button onClick={handleReset} aria-label="Reset simulation" title="Reset simulation">
        {resetConfirm ? 'Confirm?' : 'Reset'}
      </button>
      <button onClick={() => addShip('red')} aria-label="Spawn Red ship" title="Spawn Red ship">
        + Red
      </button>
      <button onClick={() => addShip('blue')} aria-label="Spawn Blue ship" title="Spawn Blue ship">
        + Blue
      </button>
      {/* Simulation modifiers moved to HUD settings */}
      <div className="speed">
        <label htmlFor="speedSelect">Speed:</label>
        <select
          id="speedSelect"
          aria-label="Simulation speed"
          value={String(timeScale)}
          onChange={(e) => setTimeScale(parseFloat(e.target.value))}
        >
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
          <option value="4">4x</option>
        </select>
      </div>
      {/* PP tuning sliders removed per request; toggles live in HUD drawers */}
    </div>
  );
}
