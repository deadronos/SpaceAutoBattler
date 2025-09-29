import React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { requestReset, spawnRandomShip } from '../game/state.js';

export function Controls(): React.ReactElement {
  const state = useOptionalGameState();
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const togglePause = useUiStore((s) => s.togglePause);
  const setTimeScale = useUiStore((s) => s.setTimeScale);

  const addShip = (team: 'red' | 'blue') => {
    if (!state) return;
    spawnRandomShip(state, team);
  };

  return (
    <div className="controls-bar">
      <button onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
      <button onClick={() => state && requestReset(state)}>Reset</button>
      <button onClick={() => addShip('red')}>+ Red</button>
      <button onClick={() => addShip('blue')}>+ Blue</button>
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
