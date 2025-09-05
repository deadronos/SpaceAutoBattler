import { createInitialState, spawnShip } from '../src/core/gameState.js';
import { updateTurretLeads, findBestTurretTarget } from '../src/core/ai/targeting.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../src/config/behaviorConfig.js';

function run() {
  const state = createInitialState('debug-turret');
  state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
  const ship = spawnShip(state, 'red', 'frigate', { x: 0, y: 0, z: 0 });
  const weakerFar = spawnShip(state, 'blue', 'destroyer', { x: 600, y: 0, z: 0 });
  weakerFar.health = weakerFar.maxHealth * 0.2;
  const strongerNear = spawnShip(state, 'blue', 'fighter', { x: 200, y: 0, z: 0 });
  strongerNear.health = strongerNear.maxHealth;
  strongerNear.level.level = 3;

  // Force reevaluation
  state.time += state.behaviorConfig.turretConfig.targetReevaluationRate + 0.01;
  for (const t of ship.turrets) {
    if (t.aiState) t.aiState.lastTargetUpdate = 0;
  }

  console.log('DEBUG_SCRIPT: before updateTurretLeads: turrets', JSON.stringify(ship.turrets.map(t => ({ id: t.id, aiState: t.aiState }))));
  updateTurretLeads(state, ship);
  console.log('DEBUG_SCRIPT: after updateTurretLeads: turrets', JSON.stringify(ship.turrets.map(t => ({ id: t.id, aiState: t.aiState }))));
  console.log('DEBUG_SCRIPT: ship.targetId (before controller fallback):', ship.targetId);

  // Call controller fallback logic mimic: find nearest enemy if turrets produced none
  const turretTargets = ship.turrets.map(t => t.aiState?.targetId ?? null);
  console.log('DEBUG_SCRIPT: turretTargets array', turretTargets);
  const firstTarget = turretTargets.find(id => id != null) ?? null;
  if (firstTarget != null) {
    ship.targetId = firstTarget;
  } else {
    // nearest fallback
    const nearest = state.ships.find(s => s.team !== ship.team && s.health > 0) ?? null;
    ship.targetId = nearest ? nearest.id : null;
  }
  console.log('DEBUG_SCRIPT: final ship.targetId', ship.targetId);
}

run();
