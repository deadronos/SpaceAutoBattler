import React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { resetGame, spawnRandomShip } from '../game/state.js';

export function Controls(): React.ReactElement {
  const state = useOptionalGameState();
  const paused = useUiStore((s) => s.paused);
  const timeScale = useUiStore((s) => s.timeScale);
  const togglePause = useUiStore((s) => s.togglePause);
  const setTimeScale = useUiStore((s) => s.setTimeScale);
  const aiEnabled = useUiStore((s) => s.aiV2Enabled);
  const toggleAi = useUiStore((s) => s.toggleAiV2);
  const aiDebugEnabled = useUiStore((s) => s.aiDebugEnabled);
  const toggleAiDebug = useUiStore((s) => s.toggleAiDebug);
  const hudHealthBarsEnabled = useUiStore((s) => s.hudHealthBarsEnabled);
  const toggleHudHealthBars = useUiStore((s) => s.toggleHudHealthBars);

  const addShip = (team: 'red' | 'blue') => {
    if (!state) return;
    spawnRandomShip(state, team);
  };

  return (
    <div className="controls-bar">
      <button onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
      <button onClick={() => state && resetGame(state)}>Reset</button>
      <button onClick={() => addShip('red')}>+ Red</button>
      <button onClick={() => addShip('blue')}>+ Blue</button>
      {/* Postprocessing toggle (off by default) */}
      <PostprocessingToggle />
      <button
        onClick={toggleHudHealthBars}
        aria-pressed={hudHealthBarsEnabled}
        title="Toggle per-ship HUD health overlays"
      >
        HUD Bars: {hudHealthBarsEnabled ? 'On' : 'Off'}
      </button>
      <button onClick={toggleAi} title="Toggle AI V2 (utility-based decision system)">
        AI V2: {aiEnabled ? 'On' : 'Off'}
      </button>
      <button
        onClick={toggleAiDebug}
        disabled={!aiEnabled}
        title="Toggle AI debug overlay (requires AI V2)"
      >
        AI Debug: {aiDebugEnabled ? 'On' : 'Off'}
      </button>
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
      {/* PP tuning sliders removed per request; keep toggle only */}
    </div>
  );
}

function PostprocessingToggle(): React.ReactElement {
  const enabled = useUiStore((s) => s.postprocessingEnabled);
  const toggle = useUiStore((s) => s.togglePostprocessing);
  return (
    <button aria-label={`Postprocessing ${enabled ? 'on' : 'off'}`} onClick={toggle} title="Toggle postprocessing (bloom/FXAA)">
      {enabled ? 'PP: On' : 'PP: Off'}
    </button>
  );
}
