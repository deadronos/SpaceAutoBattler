import type { GameState } from '../types/index.js';
import { PhysicsConfig } from '../config/physicsConfig.js';
import * as logger from '../utils/logger.js';

// Rapier physics scaffold
// Uses @dimforge/rapier3d-compat. This file creates a simple world and exposes a step function
// for the simulation loop. Keep physics state in simulation-only code to preserve determinism.

export interface PhysicsStepper {
  initDone: boolean;
  world: unknown;
  step: (dt: number) => void;
  stepAI?: (dt: number) => void; // Optional AI step function (worker mode only)
  dispose: () => void;
  // Enhanced methods
  addShip: (ship: unknown) => unknown;
  removeShip: (shipId: number) => void;
  raycast: (
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance?: number,
  ) => unknown;
  sphereCast: (center: { x: number; y: number; z: number }, radius: number) => unknown[];
  applyForce: (shipId: number, force: { x: number; y: number; z: number }) => void;
  setGravity: (gravity: { x: number; y: number; z: number }) => void;
}

export async function createPhysicsStepper(state: GameState): Promise<PhysicsStepper> {
  // Dynamically import rapier to avoid loading WASM at module eval time.
  const rapierMod = await import('@dimforge/rapier3d-compat');
  type RapierAny = { default?: unknown } & Record<string, unknown>;
  const normalize = (m: unknown): unknown => (m as RapierAny).default ?? m;
  const Rapier = normalize(rapierMod) as unknown;

  // Helper to locally escape to any for runtime API calls without adding file-level `any` annotations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asAny = (v: unknown) => v as any;

  // Create the physics world with enhanced settings
  const gravity = { x: 0, y: 0, z: 0 }; // Space has no gravity
  const RapierAny = asAny(Rapier);
  const world = new RapierAny.World(gravity);

  // Configure world settings
  world.timestep = PhysicsConfig.world.timestep;
  world.maxVelocityIterations = PhysicsConfig.world.maxVelocityIterations;
  world.maxPositionIterations = PhysicsConfig.world.maxPositionIterations;

  // Store rigid bodies by ship ID
  const rigidBodies = new Map<number, unknown>();
  const colliders = new Map<number, unknown>();

  function addShip(ship: unknown) {
    try {
      // Create rigid body descriptor based on ship class
      const rbDesc = RapierAny.RigidBodyDesc.dynamic()
        .setTranslation(asAny(ship).pos.x, asAny(ship).pos.y, asAny(ship).pos.z)
        .setLinvel(asAny(ship).vel.x, asAny(ship).vel.y, asAny(ship).vel.z)
        .setAngvel(0, 0, 0) // No initial angular velocity
        .setGravityScale(0) // No gravity in space
        .setLinearDamping(PhysicsConfig.damping.linear) // Small damping to prevent infinite sliding
        .setAngularDamping(PhysicsConfig.damping.angular); // Angular damping for stability

      const rigidBody = asAny(world).createRigidBody(rbDesc);
      rigidBodies.set(asAny(ship).id, rigidBody);

      // Create collider based on ship class
      let colliderDesc;
      const colliderDims =
        PhysicsConfig.colliders[asAny(ship).class as keyof typeof PhysicsConfig.colliders];
      if (colliderDims) {
        colliderDesc = RapierAny.ColliderDesc.cuboid(
          colliderDims.width,
          colliderDims.height,
          colliderDims.depth,
        );
      } else {
        const defaultCollider = PhysicsConfig.world.defaultCollider;
        colliderDesc = RapierAny.ColliderDesc.cuboid(
          defaultCollider.width,
          defaultCollider.height,
          defaultCollider.depth,
        );
      }

      // Configure collider properties
      colliderDesc.setDensity(PhysicsConfig.properties.density);
      colliderDesc.setFriction(PhysicsConfig.properties.friction);
      colliderDesc.setRestitution(PhysicsConfig.properties.restitution);

      const collider = asAny(world).createCollider(colliderDesc, rigidBody);
      colliders.set(asAny(ship).id, collider);

      return rigidBody;
    } catch (_e) {
      void _e;
      logger.error('Failed to create physics body for ship:', _e);
      return null;
    }
  }

  function removeShip(shipId: number) {
    try {
      const collider = colliders.get(shipId);
      if (collider) {
        asAny(world).removeCollider(collider, true);
        colliders.delete(shipId);
      }

      const rigidBody = rigidBodies.get(shipId);
      if (rigidBody) {
        asAny(world).removeRigidBody(rigidBody);
        rigidBodies.delete(shipId);
      }
    } catch (_e) {
      void _e;
      logger.error('Failed to remove physics body:', _e);
    }
  }

  function raycast(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance = PhysicsConfig.world.defaultRaycastDistance,
  ) {
    try {
      const ray = new RapierAny.Ray(origin, direction);
      const hit = world.castRay(ray, maxDistance, true);

      if (hit) {
        return {
          hit: true,
          distance: hit.toi,
          point: ray.pointAt(hit.toi),
          collider: hit.collider,
          rigidBody: hit.collider.parent(),
        };
      }

      return { hit: false };
    } catch (_e) {
      void _e;
      logger.error('Raycast failed:', _e);
      return { hit: false };
    }
  }

  function sphereCast(center: { x: number; y: number; z: number }, radius: number) {
    try {
      const shape = new RapierAny.Ball(radius);
      const shapePos = center;
      const shapeRot = { x: 0, y: 0, z: 0, w: 1 }; // Identity quaternion

      const hit = world.castShape(shapePos, shapeRot, shape, 0, true);

      if (hit) {
        return [
          {
            hit: true,
            distance: hit.toi,
            point: hit.point,
            collider: hit.collider,
            rigidBody: hit.collider.parent(),
          },
        ];
      }

      return [];
    } catch (_e) {
      void _e;
      logger.error('Sphere cast failed:', _e);
      return [];
    }
  }

  function applyForce(shipId: number, force: { x: number; y: number; z: number }) {
    try {
      const rigidBody = rigidBodies.get(shipId);
      if (rigidBody) {
        asAny(rigidBody).addForce(force, true);
      }
    } catch (_e) {
      void _e;
      logger.error('Failed to apply force:', _e);
    }
  }

  function setGravity(newGravity: { x: number; y: number; z: number }) {
    try {
      world.gravity.x = newGravity.x;
      world.gravity.y = newGravity.y;
      world.gravity.z = newGravity.z;
    } catch (_e) {
      void _e;
      logger.error('Failed to set gravity:', _e);
    }
  }

  function step(dt: number) {
    try {
      // Update physics world
      world.timestep = dt;
      world.step();

      // Update ship positions and velocities from physics
      for (const [shipId, rigidBody] of rigidBodies) {
        const ship = state.ships.find((s) => s.id === shipId);
        if (!ship) continue;

        try {
          const translation = asAny(rigidBody).translation();
          const linvel = asAny(rigidBody).linvel();

          ship.pos.x = translation.x;
          ship.pos.y = translation.y;
          ship.pos.z = translation.z;
          ship.vel.x = linvel.x;
          ship.vel.y = linvel.y;
          ship.vel.z = linvel.z;
        } catch (_e) {
          void _e;
          logger.error('Failed to update ship from physics:', _e);
        }
      }
    } catch (_e) {
      void _e;
      logger.error('Physics step failed:', _e);
    }
  }

  return {
    initDone: true,
    world,
    step,
    dispose() {
      try {
        // Clean up all colliders and rigid bodies
        for (const collider of colliders.values()) {
          world.removeCollider(collider, true);
        }
        for (const rigidBody of rigidBodies.values()) {
          world.removeRigidBody(rigidBody);
        }
        rigidBodies.clear();
        colliders.clear();
        world.free?.();
      } catch (_e) {
        void _e;
        logger.error('Failed to dispose physics world:', _e);
      }
    },
    addShip,
    removeShip,
    raycast,
    sphereCast,
    applyForce,
    setGravity,
  };
}
