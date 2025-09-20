import './styles/app.css';
import { GameProvider } from './game/context.js';
import { Battlefield } from './components/Battlefield.js';
import { Hud } from './components/Hud.js';

import type React from 'react';

export function App(): React.ReactElement {
  return (
    <GameProvider>
      <div className="app-shell">
        <div className="scene">
          <Battlefield />
        </div>
        <Hud />
      </div>
    </GameProvider>
  );
}
