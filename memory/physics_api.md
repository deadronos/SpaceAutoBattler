# physics_api

```
import type { GameState } from '../types/index.js';
import { PhysicsConfig } from '../config/physicsConfig.js';
import * as logger from '../utils/logger.js';

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
```

> Auto-generated stub — please review and expand.