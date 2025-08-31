# sim_worker_api

```
// Sim worker: handle Rapier physics in a worker and accept messages from main thread
import * as logger from './utils/logger.js';

let world: any = null;
let Rapier: any = null;
let bodies = new Map<number, any>(); // shipId -> rigidBody

async function initRapier() {
  if (Rapier) return;
  try {
    // Use dynamic import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Rapier = require('@dimforge/rapier3d-compat');
    world = new Rapier.World({ x: 0, y: 0, z: 0 });
  } catch (e) {
    Rapier = null; world = null;
  }
}

function createBodyForShip(ship: any) {
```

> Auto-generated stub — please review and expand.