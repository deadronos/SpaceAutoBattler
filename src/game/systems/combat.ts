// Re-export facade for backward compatibility
// Code has been refactored into separate domain-specific modules:
// - projectiles.ts: projectile creation, movement, lifecycle
// - turrets.ts: turret updates, target selection
// - damage.ts: projectile resolution, damage application, XP
// - sync.ts: transform synchronization

export { fireProjectile, advanceProjectiles, TEMP_POS } from './projectiles.js';
export { FORWARD } from '../../utils/steering.js';

export { findNearestEnemy, runEmbeddedTurrets, updateTurrets } from './turrets.js';

export { resolveProjectiles } from './damage.js';

export { syncTransforms } from './sync.js';
