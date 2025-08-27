import { createGameManager } from '../src/gamemanager.js';
import { srand } from '../src/rng.js';
const gm = createGameManager({ renderer: null, createSimWorker: () => { throw new Error('no worker'); } });
let captured = null;
cmOn: gm.on('reinforcements', (m) => { captured = m; });
srand(123);
gm.setContinuousOptions({ shipTypes: ['corvette', 'frigate'], perTick: 3, scoreMargin: 0.01 });
gm.setReinforcementInterval(0.01);
gm.setContinuousEnabled(true);
gm._internal.state.ships = [];
for (let i = 0; i < 5; i++)
    gm._internal.state.ships.push({ id: 2000 + i, type: 'fighter', team: 'blue', hp: 10 });
gm.stepOnce(0.02);
console.log('captured:', captured);
console.log('lastReinforcement:', gm.getLastReinforcement());
