import type {
  GameState,
  Ship,
  ShipClass,
  Team,
  Vector3,
  EntityId,
  TurretState,
} from '../../types/index.js';
import type { PhysicsAdapter } from '../adapters/physicsAdapter.js';
import type { RendererAdapter } from '../adapters/rendererAdapter.js';
import type { SpatialIndex } from '../spatialIndex.js';
import { getShipClassConfig } from '../../config/entitiesConfig.js';
import * as logger from '../../utils/logger.js';
import { nextLevelXp, applyLevelUps } from '../../config/progression.js';
import { FleetConfig } from '../../config/fleetConfig.js';
import { CarrierSpawnConfig } from '../../config/carrierSpawnConfig.js';

/**
 * Spawn intent describes a request to create an entity
 */
export interface SpawnIntent {
  type: 'ship' | 'bullet' | 'effect';
  team: Team;
  class?: ShipClass;
  position?: Vector3;
  parentId?: EntityId;
  // Additional spawn properties
  initialVelocity?: Vector3;
  initialOrientation?: { pitch: number; yaw: number; roll: number };
  // customConfig is intentionally unstructured; use unknown to avoid `any`
  // while forcing callers to refine the shape when accessing it.
  customConfig?: Record<string, unknown>;
}

/**
 * Spawn result containing the created entity and any side effects
 */
export interface SpawnResult {
  entityId: EntityId;
  success: boolean;
  error?: string;
  spawnedEntity?: Ship; // For ship spawns
}

/**
 * Spawn event for notifications
 */
export interface SpawnEvent {
  type: 'spawned' | 'failed';
  intent: SpawnIntent;
  result: SpawnResult;
  timestamp: number;
}

/**
 * SpawnSystem centralizes entity creation/destruction with proper
 * lifecycle management and adapter coordination.
 */
export class SpawnSystem {
  private state: GameState;
  private physicsAdapter?: PhysicsAdapter;
  private rendererAdapter?: RendererAdapter;
  private spatialIndex?: SpatialIndex;
  // Optional instrumentation toggle for debugging/perf investigation
  private instrumentationEnabled = false;
  // Cache for renderer-related parameter objects (keyed by program-like objects)
  // We don't assume a specific shape — callers must pass the canonical object used by the renderer.
  private rendererParametersCache = new WeakMap<object, unknown>();
  private eventHandlers: ((event: SpawnEvent) => void)[] = [];

  constructor(
    state: GameState,
    adapters?: {
      physics?: PhysicsAdapter;
      renderer?: RendererAdapter;
      spatial?: SpatialIndex;
    },
  ) {
    this.state = state;
    this.physicsAdapter = adapters?.physics;
    this.rendererAdapter = adapters?.renderer;
    this.spatialIndex = adapters?.spatial;
  }

  /**
   * Subscribe to spawn events
   */
  onSpawnEvent(handler: (event: SpawnEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index >= 0) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  private emitEvent(event: SpawnEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (_error) {
        void _error;
        logger.warn('Error in spawn event handler:', _error);
      }
    }
  }

  /**
   * Spawn a ship with proper initialization
   */
  spawnShip(intent: SpawnIntent): SpawnResult {
    if (intent.type !== 'ship' || !intent.class) {
      const result: SpawnResult = {
        entityId: -1,
        success: false,
        error: 'Invalid ship spawn intent',
      };
      this.emitEvent({
        type: 'failed',
        intent,
        result,
        timestamp: this.state.time,
      });
      return result;
    }

    try {
      const ship = this.createShip(intent);
      const result: SpawnResult = {
        entityId: ship.id,
        success: true,
        spawnedEntity: ship,
      };

      // Register with adapters
      this.registerShipWithAdapters(ship);

      this.emitEvent({
        type: 'spawned',
        intent,
        result,
        timestamp: this.state.time,
      });

      return result;
    } catch (_error) {
      void _error;
      const result: SpawnResult = {
        entityId: -1,
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown spawn error',
      };
      this.emitEvent({
        type: 'failed',
        intent,
        result,
        timestamp: this.state.time,
      });
      return result;
    }
  }

  /**
   * Spawn multiple ships (fleet spawning)
   */
  spawnFleet(
    team: Team,
    count: number = 5,
    options?: {
      classes?: ShipClass[];
      formation?: 'random' | 'line' | 'wedge';
    },
  ): SpawnResult[] {
    const results: SpawnResult[] = [];

    for (let i = 0; i < count; i++) {
      const cls = options?.classes
        ? this.state.rng.pick(options.classes)
        : this.state.rng.pick(['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'] as const);

      const position =
        options?.formation === 'line'
          ? this.calculateFormationPosition(team, i, count, 'line')
          : options?.formation === 'wedge'
            ? this.calculateFormationPosition(team, i, count, 'wedge')
            : undefined; // Random position

      const intent: SpawnIntent = {
        type: 'ship',
        team,
        class: cls,
        position,
      };

      results.push(this.spawnShip(intent));
    }

    return results;
  }

  /**
   * Remove ship and clean up adapters
   */
  removeShip(shipId: EntityId): boolean {
    const shipIndex = this.state.ships.findIndex((s) => s.id === shipId);
    if (shipIndex === -1) {
      return false;
    }
    const ship = this.state.ships[shipIndex];

    // Attempt to invalidate any renderer-side cached parameters for this ship's program-like object
    try {
      const programLike = (ship as unknown as Record<string, unknown>).__renderProgram as
        | object
        | undefined;
      if (programLike) {
        // Ask adapter to invalidate its internal cache if it supports it
        try {
          const maybeAdapter = this.rendererAdapter as unknown as
            | { invalidateParameters?: (p: object) => void }
            | undefined;
          if (maybeAdapter && typeof maybeAdapter.invalidateParameters === 'function') {
            maybeAdapter.invalidateParameters(programLike);
          }
        } catch {
          // ignore adapter failure
        }

        // Remove from local WeakMap cache too (best-effort)
        try {
          this.rendererParametersCache.delete(programLike);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    // Remove from adapters
    this.rendererAdapter?.removeShip(shipId);
    this.physicsAdapter?.removeBody(shipId);
    this.spatialIndex?.remove(shipId);
    // Also remove from entityIndex if present
    try {
      if (this.state.entityIndex) this.state.entityIndex.remove(shipId);
    } catch {
      /* best-effort */
    }

    // Remove from state
    this.state.ships.splice(shipIndex, 1);
    this.state.shipIndex?.delete(shipId);

    return true;
  }

  /**
   * Get spawn statistics
   */
  getStats(): {
    totalShips: number;
    shipsByTeam: Record<Team, number>;
    shipsByClass: Record<ShipClass, number>;
    nextId: number;
  } {
    const shipsByTeam = { red: 0, blue: 0 } as Record<Team, number>;
    const shipsByClass = {
      fighter: 0,
      corvette: 0,
      frigate: 0,
      destroyer: 0,
      carrier: 0,
    } as Record<ShipClass, number>;

    for (const ship of this.state.ships) {
      shipsByTeam[ship.team]++;
      shipsByClass[ship.class]++;
    }

    return {
      totalShips: this.state.ships.length,
      shipsByTeam,
      shipsByClass,
      nextId: this.state.nextId,
    };
  }

  private createShip(intent: SpawnIntent): Ship {
    const cfg = getShipClassConfig(intent.class!);
    const id = this.allocateId();
    const level = { level: 1, xp: 0, nextLevelXp: nextLevelXp(1) };
    const maxHealth = Math.floor(applyLevelUps(level.level, cfg.baseHealth));
    const maxShield = Math.floor(applyLevelUps(level.level, cfg.shield));
    const turrets: TurretState[] = cfg.turrets.map((t, i) => ({
      id: `${t.id}-${i}`,
      cooldownLeft: 0,
    }));

    const pos = intent.position ?? this.randomSpawnPos(intent.team);
    const randomYaw = this.state.rng.next() * Math.PI * 2;

    const ship: Ship = {
      id,
      team: intent.team,
      class: intent.class!,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      vel: intent.initialVelocity ?? { x: 0, y: 0, z: 0 },
      orientation: intent.initialOrientation ?? {
        pitch: 0,
        yaw: randomYaw,
        roll: 0,
      },
      dir: randomYaw, // Legacy compatibility
      targetId: null,
      health: maxHealth,
      maxHealth,
      armor: cfg.armor,
      shield: maxShield,
      maxShield,
      shieldRegen: cfg.shieldRegen,
      speed: cfg.speed,
      turnRate: cfg.turnRate,
      turrets,
      kills: 0,
      level,
      spawnedFighters: intent.class === 'carrier' ? 0 : undefined,
      fighterSpawnCdLeft:
        intent.class === 'carrier' ? CarrierSpawnConfig.fighter.initialCooldown : undefined,
      parentCarrierId: intent.parentId,
    };

    // Apply spawn jitter if enabled
    this.applySpawnJitter(ship);

    // Add to state
    this.state.ships.push(ship);
    this.state.shipIndex?.set(ship.id, ship);

    return ship;
  }

  private applySpawnJitter(ship: Ship): void {
    const enableJitter = this.state.behaviorConfig?.globalSettings.enableSpawnJitter;
    if (enableJitter) {
      const jitterScale = 0.02; // fraction of ship.speed per second
      const angle = this.state.rng.next() * Math.PI * 2;
      const jitterMag = ship.speed * jitterScale;
      ship.vel.x += Math.cos(angle) * jitterMag;
      ship.vel.y += Math.sin(angle) * jitterMag;
    }
  }

  private randomSpawnPos(team: Team): Vector3 {
    const margin = FleetConfig.spawning.margin;
    const y = this.state.rng.int(margin, this.state.simConfig.simBounds.height - margin);
    const z = this.state.rng.int(margin, this.state.simConfig.simBounds.depth - margin);
    const x =
      team === 'red'
        ? this.state.rng.int(margin, margin + FleetConfig.spawning.spawnWidth)
        : this.state.rng.int(
            this.state.simConfig.simBounds.width - margin - FleetConfig.spawning.spawnWidth,
            this.state.simConfig.simBounds.width - margin,
          );
    return { x, y, z };
  }

  private calculateFormationPosition(
    team: Team,
    index: number,
    total: number,
    formation: 'line' | 'wedge',
  ): Vector3 {
    const basePos = this.randomSpawnPos(team);
    const spacing = 50; // Distance between ships in formation

    switch (formation) {
      case 'line': {
        const offset = (index - total / 2) * spacing;
        return {
          x: basePos.x,
          y: basePos.y + offset,
          z: basePos.z,
        };
      }
      case 'wedge': {
        const row = Math.floor(Math.sqrt(index * 2));
        const posInRow = index - (row * (row + 1)) / 2;
        const rowWidth = (row + 1) * spacing;
        const yOffset = posInRow * spacing - rowWidth / 2;
        const xOffset = row * spacing * 0.5;

        return {
          x: basePos.x + (team === 'red' ? xOffset : -xOffset),
          y: basePos.y + yOffset,
          z: basePos.z,
        };
      }
      default:
        return basePos;
    }
  }

  private registerShipWithAdapters(ship: Ship): void {
    // Register with physics
    try {
      if (this.physicsAdapter) {
        const cfg = getShipClassConfig(ship.class);
        this.physicsAdapter.addBody(ship.id, {
          position: ship.pos,
          velocity: ship.vel,
          mass: cfg.baseHealth, // Use health as mass approximation
          radius: 20, // Default ship radius
          collisionMask: ship.team === 'red' ? 0x01 : 0x02,
        });
      }
    } catch (_error) {
      void _error;
      logger.warn('Failed to register ship with physics adapter:', _error);
    }

    // Register with renderer
    try {
      if (this.rendererAdapter) {
        if (this.instrumentationEnabled) {
          try {
            logger.debug('renderer.ensureMeshForShip');
          } catch (_e) {
            void _e;
            void _e;
          }
        }

        // If the renderer adapter exposes a program/parameter object on the ship (conventionally
        // some adapters attach a reference after first creation) we try to avoid repeated expensive
        // parameter computation by caching results keyed by that object. This is a no-op for adapters
        // that don't follow that convention.
        // Usage: adapter implementations may choose to attach `__renderProgram` or similar to ship
        // after the first call. This helper is intentionally conservative and will not mutate ship.
        const programLike = (ship as unknown as Record<string, unknown>).__renderProgram as
          | object
          | undefined;
        if (programLike && typeof this.rendererParametersCache.get === 'function') {
          // If we already have cached parameters for this program-like object, we could use it.
          // We don't change adapter behavior here, but this cache can be read by future helpers
          // or instrumented code paths to avoid repeating heavy work.
          if (!this.rendererParametersCache.has(programLike)) {
            try {
              // If adapter exposes a `getParameters` method we call it once and cache the result.
              const maybeAdapter = this.rendererAdapter as unknown as
                | { getParameters?: (p: object) => unknown }
                | undefined;
              if (maybeAdapter && typeof maybeAdapter.getParameters === 'function') {
                const params = maybeAdapter.getParameters(programLike);
                this.rendererParametersCache.set(programLike, params);
              }
            } catch {
              // Swallow: this is best-effort instrumentation/caching
            }
          }
        }

        this.rendererAdapter.ensureMeshForShip(ship);
      }
    } catch (_error) {
      void _error;
      logger.warn('Failed to register ship with renderer adapter:', _error);
    }

    // Register with spatial index
    try {
      if (this.spatialIndex) {
        this.spatialIndex.insert(ship.id, ship.pos, 20, ship.team);
      }
    } catch (_error) {
      void _error;
      logger.warn('Failed to register ship with spatial index:', _error);
    }
    // Register with entityIndex (miniplex + uniform grid) if available on GameState
    try {
      if (this.state.entityIndex) {
        try {
          this.state.entityIndex.add({
            id: ship.id,
            x: ship.pos.x,
            y: ship.pos.y,
            z: ship.pos.z,
            team: ship.team,
            type: 'ship',
            radius: 20,
          });
        } catch (e) {
          void e;
        }
      }
    } catch (_e) {
      void _e; // best-effort
    }
  }

  private allocateId(): EntityId {
    return this.state.nextId++;
  }
}
