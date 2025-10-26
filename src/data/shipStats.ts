/**
 * Backward compatibility re-export from the refactored ships module.
 * The data has been split into individual ship hull files in src/data/ships/ for better modularity.
 *
 * @deprecated Use `import { SHIP_STATS } from './ships/index.js'` instead.
 */
export { SHIP_STATS, getShipStats, listShipTypes, isValidShipHull } from './ships/index.js';
