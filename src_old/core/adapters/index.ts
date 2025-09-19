// Export all adapter interfaces and implementations
export * from './physicsAdapter.js';
export * from './rendererAdapter.js';
export * from './timeAdapter.js';
export type { SpatialIndex, SpatialQueryResult } from '../spatialIndex.js';
export { SpatialGridAdapter, NoopSpatialIndex } from '../spatialIndex.js';
