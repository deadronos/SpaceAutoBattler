import type { GameState } from '../types/index.js';
import { PhysicsConfig } from '../config/physicsConfig.js';

// Rapier physics scaffold
// Uses @dimforge/rapier3d-compat. This file creates a simple world and exposes a step function
// for the simulation loop. Keep physics state in simulation-only code to preserve determinism.

export interface PhysicsStepper {
  initDone: boolean;
  world: any;
  step: (dt: number) => void;
  dispose: () => void;
  // Enhanced methods
  addShip: (ship: any) => any;
  removeShip: (shipId: number) => void;
  raycast: (origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, maxDistance?: number) => any;
  sphereCast: (center: { x: number; y: number; z: number }, radius: number) => any[];
  applyForce: (shipId: number, force: { x: number; y: number; z: number }) => void;
  setGravity: (gravity: { x: number; y: number; z: number }) => void;
}

export async function createPhysicsStepper(state: GameState): Promise<PhysicsStepper> {
  // Dynamically import rapier to avoid loading WASM at module eval time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Rapier = require('@dimforge/rapier3d-compat') as any;

  // Create the physics world with enhanced settings
  const gravity = { x: 0, y: 0, z: 0 }; // Space has no gravity
  const world = new Rapier.World(gravity);

  // Configure world settings
  world.timestep = 1 / 60; // 60 FPS physics
  world.maxVelocityIterations = 8;
  world.maxPositionIterations = 4;

  // Store rigid bodies by ship ID
  const rigidBodies = new Map<number, any>();
  const colliders = new Map<number, any>();

  function addShip(ship: any) {
    try {
      // Create rigid body descriptor based on ship class
      const rbDesc = Rapier.RigidBodyDesc.dynamic()
        .setTranslation(ship.pos.x, ship.pos.y, ship.pos.z)
        .setLinvel(ship.vel.x, ship.vel.y, ship.vel.z)
        .setAngvel(0, 0, 0) // No initial angular velocity
        .setGravityScale(0) // No gravity in space
        .setLinearDamping(PhysicsConfig.damping.linear) // Small damping to prevent infinite sliding
        .setAngularDamping(PhysicsConfig.damping.angular); // Angular damping for stability

      const rigidBody = world.createRigidBody(rbDesc);
      rigidBodies.set(ship.id, rigidBody);

      // Create collider based on ship class
      let colliderDesc;
      const colliderDims = PhysicsConfig.colliders[ship.class as keyof typeof PhysicsConfig.colliders];
      if (colliderDims) {
        colliderDesc = Rapier.ColliderDesc.cuboid(colliderDims.width, colliderDims.height, colliderDims.depth);
      } else {
        colliderDesc = Rapier.ColliderDesc.cuboid(5, 2, 5);
      }

      // Configure collider properties
      colliderDesc.setDensity(PhysicsConfig.properties.density);
      colliderDesc.setFriction(PhysicsConfig.properties.friction);
      colliderDesc.setRestitution(PhysicsConfig.properties.restitution);

      const collider = world.createCollider(colliderDesc, rigidBody);
      colliders.set(ship.id, collider);

      return rigidBody;
    } catch (e) {
      console.error('Failed to create physics body for ship:', e);
      return null;
    }
  }

  function removeShip(shipId: number) {
    try {
      const collider = colliders.get(shipId);
      if (collider) {
        world.removeCollider(collider, true);
        colliders.delete(shipId);
      }

      const rigidBody = rigidBodies.get(shipId);
      if (rigidBody) {
        world.removeRigidBody(rigidBody);
        rigidBodies.delete(shipId);
      }
    } catch (e) {
      console.error('Failed to remove physics body:', e);
    }
  }

  function raycast(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, maxDistance = 1000) {
    try {
      const ray = new Rapier.Ray(origin, direction);
      const hit = world.castRay(ray, maxDistance, true);

      if (hit) {
        return {
          hit: true,
          distance: hit.toi,
          point: ray.pointAt(hit.toi),
          collider: hit.collider,
          rigidBody: hit.collider.parent()
        };
      }

      return { hit: false };
    } catch (e) {
      console.error('Raycast failed:', e);
      return { hit: false };
    }
  }

  function sphereCast(center: { x: number; y: number; z: number }, radius: number) {
    try {
      const shape = new Rapier.Ball(radius);
      const shapePos = center;
      const shapeRot = { x: 0, y: 0, z: 0, w: 1 }; // Identity quaternion

      const hit = world.castShape(shapePos, shapeRot, shape, 0, true);

      if (hit) {
        return [{
          hit: true,
          distance: hit.toi,
          point: hit.point,
          collider: hit.collider,
          rigidBody: hit.collider.parent()
        }];
      }

      return [];
    } catch (e) {
      console.error('Sphere cast failed:', e);
      return [];
    }
  }

  function applyForce(shipId: number, force: { x: number; y: number; z: number }) {
    try {
      const rigidBody = rigidBodies.get(shipId);
      if (rigidBody) {
        rigidBody.addForce(force, true);
      }
    } catch (e) {
      console.error('Failed to apply force:', e);
    }
  }

  function setGravity(newGravity: { x: number; y: number; z: number }) {
    try {
      world.gravity.x = newGravity.x;
      world.gravity.y = newGravity.y;
      world.gravity.z = newGravity.z;
    } catch (e) {
      console.error('Failed to set gravity:', e);
    }
  }

  function step(dt: number) {
    try {
      // Update physics world
      world.timestep = dt;
      world.step();

      // Update ship positions and velocities from physics
      for (const [shipId, rigidBody] of rigidBodies) {
        const ship = state.ships.find(s => s.id === shipId);
        if (!ship) continue;

        try {
          const translation = rigidBody.translation();
          const linvel = rigidBody.linvel();

          ship.pos.x = translation.x;
          ship.pos.y = translation.y;
          ship.pos.z = translation.z;
          ship.vel.x = linvel.x;
          ship.vel.y = linvel.y;
          ship.vel.z = linvel.z;
        } catch (e) {
          console.error('Failed to update ship from physics:', e);
        }
      }
    } catch (e) {
      console.error('Physics step failed:', e);
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
      } catch (e) {
        console.error('Failed to dispose physics world:', e);
      }
    },
    addShip,
    removeShip,
    raycast,
    sphereCast,
    applyForce,
    setGravity
  };
}
