import './styles/app.css';
import { GameProvider } from './game/context.js';
import { Battlefield } from './components/Battlefield.js';
import { Hud } from './components/Hud.js';
import { Controls } from './components/Controls.js';
import RingDebugPanel from './debug/RingDebugPanel.js';

import type React from 'react';

/**
 * Root application component.
 *
 * Sets up the GameProvider and renders the main UI layout including the Battlefield (3D scene),
 * HUD, Controls, and debug panels.
 *
 * @returns {React.ReactElement} The rendered application component.
 */
export function App(): React.ReactElement {
  return (
    <GameProvider>
      <div className="app-shell">
        <div className="scene">
          <Battlefield />
        </div>
        <Hud />
        <Controls />
        <RingDebugPanel />
      </div>
    </GameProvider>
  );
}
