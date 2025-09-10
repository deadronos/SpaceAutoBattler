/**
 * TimeAdapter provides deterministic time management for simulation consistency.
 * Enables pausing, time scaling, and controllable time sources for testing.
 */
export interface TimeAdapter {
  /**
   * Get current time in milliseconds (simulation time, not wall clock)
   */
  now(): number;

  /**
   * Get delta time since last frame in seconds
   */
  delta(): number;

  /**
   * Set time scale factor (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
   */
  scale(factor: number): void;

  /**
   * Pause simulation time
   */
  pause(): void;

  /**
   * Resume simulation time
   */
  resume(): void;

  /**
   * Get current time state
   */
  getState(): {
    time: number;
    paused: boolean;
    scale: number;
    lastFrameTime: number;
  };

  /**
   * Step simulation time by a fixed amount (useful for deterministic testing)
   */
  step(dt: number): void;

  /**
   * Reset time to zero
   */
  reset(): void;
}

/**
 * Real-time adapter using performance.now() for production use
 */
export class RealTimeAdapter implements TimeAdapter {
  private startTime: number;
  private pausedTime: number;
  private lastTime: number;
  private timeScale: number;
  private paused: boolean;
  private accumulatedTime: number;

  constructor() {
    this.startTime = performance.now();
    this.pausedTime = 0;
    this.lastTime = this.startTime;
    this.timeScale = 1.0;
    this.paused = false;
    this.accumulatedTime = 0;
  }

  now(): number {
    if (this.paused) {
      return this.pausedTime;
    }
    return (performance.now() - this.startTime) * this.timeScale + this.accumulatedTime;
  }

  delta(): number {
    const currentTime = this.now();
    const dt = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;
    return dt;
  }

  scale(factor: number): void {
    if (factor < 0) throw new Error('Time scale must be non-negative');
    this.timeScale = factor;
  }

  pause(): void {
    if (!this.paused) {
      this.pausedTime = this.now();
      this.paused = true;
    }
  }

  resume(): void {
    if (this.paused) {
      this.accumulatedTime +=
        this.pausedTime - (performance.now() - this.startTime) * this.timeScale;
      this.paused = false;
    }
  }

  getState() {
    return {
      time: this.now(),
      paused: this.paused,
      scale: this.timeScale,
      lastFrameTime: this.lastTime,
    };
  }

  step(dt: number): void {
    // In real-time mode, step() just advances the last frame time
    this.lastTime += dt * 1000; // Convert to milliseconds
  }

  reset(): void {
    this.startTime = performance.now();
    this.pausedTime = 0;
    this.lastTime = this.startTime;
    this.accumulatedTime = 0;
    this.paused = false;
  }
}

/**
 * Mock time adapter for deterministic testing
 */
export class MockTimeAdapter implements TimeAdapter {
  private currentTime: number;
  private lastFrameTime: number;
  private timeScale: number;
  private paused: boolean;

  constructor(initialTime: number = 0) {
    this.currentTime = initialTime;
    this.lastFrameTime = initialTime;
    this.timeScale = 1.0;
    this.paused = false;
  }

  now(): number {
    return this.currentTime;
  }

  delta(): number {
    const dt = (this.currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = this.currentTime;
    return dt;
  }

  scale(factor: number): void {
    if (factor < 0) throw new Error('Time scale must be non-negative');
    this.timeScale = factor;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getState() {
    return {
      time: this.currentTime,
      paused: this.paused,
      scale: this.timeScale,
      lastFrameTime: this.lastFrameTime,
    };
  }

  step(dt: number): void {
    if (!this.paused) {
      this.currentTime += dt * this.timeScale; // dt should be in milliseconds for consistency
    }
  }

  reset(): void {
    this.currentTime = 0;
    this.lastFrameTime = 0;
    this.timeScale = 1.0;
    this.paused = false;
  }

  /**
   * Test utility: manually set the current time
   */
  setTime(time: number): void {
    this.currentTime = time;
  }
}
