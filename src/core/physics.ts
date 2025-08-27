import type { GameState } from '../types/index.js';

// Rapier physics scaffold
// Uses @dimforge/rapier3d-compat. This file creates a simple world and exposes a step function
// for the simulation loop. Keep physics state in simulation-only code to preserve determinism.

export interface PhysicsStepper {
  initDone: boolean;
  world: any;
  step: (dt: number) => void;
  dispose: () => void;
}

export async function createPhysicsStepper(state: GameState): Promise<PhysicsStepper> {
  // Dynamically import rapier to avoid loading WASM at module eval time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Rapier = require('@dimforge/rapier3d-compat') as any;

  // Create the physics world
  const world = new Rapier.World({ x: 0, y: 0, z: 0 });

  function step(dt: number) {
    try {
      // Rapier expects seconds; typical step usage is world.step(dt)
      world.timestep = dt;
      world.step();
    } catch (e) {
      // ignore scaffold errors
    }
  }

  return {
    initDone: true,
    world,
    step,
    dispose() {
      try { world.free?.(); } catch (e) { /* ignore */ }
    }
  };
}
