/**
 * PhysicsAdapter is a minimal proxy over the optional physicsStepper
 * already present on GameState. This interface exists to enable tests to
 * swap or stub physics behavior without coupling to the concrete stepper.
 */
export interface PhysicsAdapter {
  initDone: boolean;
  step(dt: number): void;
  dispose(): void;
  world?: any;
}

/**
 * No-op physics adapter for tests; safely ignores steps.
 */
export class NoopPhysicsAdapter implements PhysicsAdapter {
  initDone = true;
  step(_dt: number): void {}
  dispose(): void {}
}
