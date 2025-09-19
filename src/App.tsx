import './styles/app.css';
import { GameProvider } from './game/context.js';
import { Battlefield } from './components/Battlefield.js';
import { Hud } from './components/Hud.js';

export function App(): JSX.Element {
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
