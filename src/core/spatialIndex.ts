import type { Vector3, EntityId, Team } from '../types/index.js';
import type { SpatialGrid, SpatialEntity } from '../utils/spatialGrid.js';

/**
 * SpatialIndex adapter interface to decouple AI from a concrete grid.
 * This wraps the existing SpatialGrid API to enable future substitution in tests.
 */
export interface SpatialIndex {
  clear(): void;
  update(id: EntityId, pos: Vector3, radius: number, team: Team): void;
  remove(id: EntityId): void;
  gcExcept(activeIds: Set<EntityId>): void;
  queryRadius(center: Vector3, radius: number, out?: SpatialEntity[]): SpatialEntity[];
  forEachInRadius(
    center: Vector3,
    radius: number,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void
  ): void;
  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId): SpatialEntity[];
  querySector(center: Vector3, direction: Vector3, angleRadians: number, range: number, team?: Team, excludeId?: EntityId): SpatialEntity[];
  queryNeighbors(center: Vector3, radius: number, team: Team, excludeId?: EntityId): SpatialEntity[];
  forEachNeighborsDelta(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId: EntityId | undefined,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void
  ): void;
  queryEnemies(center: Vector3, radius: number, team: Team): SpatialEntity[];
  queryBulletCollisions(bulletPos: Vector3, bulletRadius: number, maxShipRadius?: number): SpatialEntity[];
}

/**
 * Adapter implementation that delegates to the existing SpatialGrid.
 * This is a thin wrapper and does not change behavior.
 */
export class SpatialGridAdapter implements SpatialIndex {
  constructor(private grid: SpatialGrid) {}
  clear() { this.grid.clear(); }
  update(id: EntityId, pos: Vector3, radius: number, team: Team) { this.grid.update(id, pos, radius, team); }
  remove(id: EntityId) { this.grid.remove(id); }
  gcExcept(activeIds: Set<EntityId>) { this.grid.gcExcept(activeIds); }
  queryRadius(center: Vector3, radius: number, out?: SpatialEntity[]) { return this.grid.queryRadius(center, radius, out); }
  forEachInRadius(center: Vector3, radius: number, fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void) { this.grid.forEachInRadius(center, radius, fn); }
  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId) { return this.grid.queryKNearest(center, k, team, excludeId); }
  querySector(center: Vector3, direction: Vector3, angleRadians: number, range: number, team?: Team, excludeId?: EntityId) { return this.grid.querySector(center, direction, angleRadians, range, team, excludeId); }
  queryNeighbors(center: Vector3, radius: number, team: Team, excludeId?: EntityId) { return this.grid.queryNeighbors(center, radius, team, excludeId); }
  forEachNeighborsDelta(center: Vector3, radius: number, team: Team, excludeId: EntityId | undefined, fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void) { this.grid.forEachNeighborsDelta(center, radius, team, excludeId, fn); }
  queryEnemies(center: Vector3, radius: number, team: Team) { return this.grid.queryEnemies(center, radius, team); }
  queryBulletCollisions(bulletPos: Vector3, bulletRadius: number, maxShipRadius?: number) { return this.grid.queryBulletCollisions(bulletPos, bulletRadius, maxShipRadius); }
}
