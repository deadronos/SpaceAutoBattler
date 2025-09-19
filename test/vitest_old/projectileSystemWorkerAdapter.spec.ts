import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInitialState } from '../../src/core/gameState.js';
import { ProjectileSystemWorkerAdapter } from '../../src/core/systems/projectileSystemWorkerAdapter.js';
import type { GameState, Bullet, Ship } from '../../src/types/index.js';
import { createRNG } from '../../src/utils/rng.js';

describe('ProjectileSystemWorkerAdapter', () => {
  let state: GameState;
  let adapter: ProjectileSystemWorkerAdapter;
  let mockWorker: {
    postMessage: ReturnType<typeof vitest.fn>;
    addEventListener: ReturnType<typeof vitest.fn>;
  };

  beforeEach(() => {
    state = createInitialState();
    state.rng = createRNG('test-seed');
    
    // Create a mock worker
    mockWorker = {
      postMessage: vitest.fn(),
      addEventListener: vitest.fn(),
    };

    adapter = new ProjectileSystemWorkerAdapter(
      state,
      {}, // no adapters for simple test
      mockWorker as any
    );

    // Add test ships
    const redShip: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 0, y: 0, z: 0 },
      prevPos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      prevOrientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      armor: 10,
      shieldRegen: 5,
      speed: 100,
      turnRate: 1.0,
      kills: 0,
      turrets: [{
        id: 'main',
        cooldownLeft: 0,
        aiState: {
          targetId: null,
          lastTargetUpdate: 0,
        }
      }],
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      lastShieldHitTime: 0,
      lastShieldHitStrength: 0,
      lastShieldHitDir: { x: 0, y: 0, z: 0 },
      _healthDirty: false,
      _shieldDirty: false,
    };

    const blueShip: Ship = {
      ...redShip,
      id: 2,
      team: 'blue',
      pos: { x: 100, y: 0, z: 0 }, // Close enough for range check
    };

    state.ships.push(redShip, blueShip);
  });

  afterEach(() => {
    adapter = null as any;
    mockWorker = null as any;
  });

  describe('fire()', () => {
    it('should create bullet locally and send to worker', () => {
      const fireIntent = {
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      };

      const bulletId = adapter.fire(fireIntent);

      expect(bulletId).toBeDefined();
      expect(typeof bulletId).toBe('number');

      // Should add bullet to local state
      expect(state.bullets).toHaveLength(1);
      const bullet = state.bullets[0];
      expect(bullet.id).toBe(bulletId);
      expect(bullet.ownerShipId).toBe(1);
      expect(bullet.ownerTeam).toBe('red');

      // Should send bullet to worker
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'fire-bullet',
        payload: {
          id: bulletId,
          ownerShipId: 1,
          ownerTeam: 'red',
          pos: bullet.pos,
          vel: bullet.vel,
          ttl: bullet.ttl,
          damage: bullet.damage,
        },
      });
    });

    it('should not fire when ship is not found', () => {
      const fireIntent = {
        sourceShipId: 999, // Non-existent ship
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      };

      const bulletId = adapter.fire(fireIntent);

      expect(bulletId).toBeNull();
      expect(state.bullets).toHaveLength(0);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });

    it('should not fire when turret is on cooldown', () => {
      // Set turret cooldown
      state.ships[0].turrets[0].cooldownLeft = 1.0;

      const fireIntent = {
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      };

      const bulletId = adapter.fire(fireIntent);

      expect(bulletId).toBeNull();
      expect(state.bullets).toHaveLength(0);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });

    it('should not fire when target is out of range', () => {
      const fireIntent = {
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 10000, y: 0, z: 0 }, // Too far
      };

      const bulletId = adapter.fire(fireIntent);

      expect(bulletId).toBeNull();
      expect(state.bullets).toHaveLength(0);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });

    it('should set turret cooldown after firing', () => {
      const fireIntent = {
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      };

      const bulletId = adapter.fire(fireIntent);

      expect(bulletId).toBeDefined();
      expect(state.ships[0].turrets[0].cooldownLeft).toBeGreaterThan(0);
    });
  });

  describe('removeBullet()', () => {
    it('should remove bullet from local state and notify worker', () => {
      // First, create a bullet
      const fireIntent = {
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      };

      const bulletId = adapter.fire(fireIntent);
      expect(state.bullets).toHaveLength(1);

      // Clear previous calls
      mockWorker.postMessage.mockClear();

      // Remove the bullet
      const removed = adapter.removeBullet(bulletId!);

      expect(removed).toBe(true);
      expect(state.bullets).toHaveLength(0);

      // Should notify worker
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'remove-bullet',
        payload: { bulletId },
      });
    });

    it('should return false when bullet not found', () => {
      const removed = adapter.removeBullet(999);
      
      expect(removed).toBe(false);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('getStats()', () => {
    it('should return correct bullet statistics', () => {
      // Create some bullets
      adapter.fire({
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      });

      // Ship 2 is blue team and needs turret setup
      state.ships[1].turrets[0].cooldownLeft = 0; // Reset cooldown
      adapter.fire({
        sourceShipId: 2,
        turretId: 'main',
        targetPosition: { x: 0, y: 0, z: 0 },
      });

      const stats = adapter.getStats();

      expect(stats.totalBullets).toBe(2);
      expect(stats.bulletsByTeam.red).toBe(1);
      expect(stats.bulletsByTeam.blue).toBe(1);
      expect(stats.avgTTL).toBeGreaterThan(0);
      expect(stats.avgSpeed).toBeGreaterThan(0);
    });

    it('should handle empty bullet state', () => {
      const stats = adapter.getStats();

      expect(stats.totalBullets).toBe(0);
      expect(stats.bulletsByTeam.red).toBe(0);
      expect(stats.bulletsByTeam.blue).toBe(0);
      expect(stats.avgTTL).toBe(0);
      expect(stats.avgSpeed).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should emit fired event when bullet is created', async () => {
      const events: any[] = [];
      adapter.onProjectileEvent((event) => {
        events.push(event);
      });

      const bulletId = adapter.fire({
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      });

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('fired');
      expect(events[0].bulletId).toBe(bulletId);
      expect(events[0].sourceShipId).toBe(1);
    });

    it('should emit destroyed event when bullet is removed', async () => {
      const events: any[] = [];
      adapter.onProjectileEvent((event) => {
        events.push(event);
      });

      const bulletId = adapter.fire({
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      });

      adapter.removeBullet(bulletId!);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(events).toHaveLength(2); // fired + destroyed
      expect(events[1].type).toBe('destroyed');
      expect(events[1].bulletId).toBe(bulletId);
    });
  });

  describe('performance tracking', () => {
    it('should track performance when debugPerf is enabled', () => {
      // Mock window.location.search to include debugPerf=1
      Object.defineProperty(window, 'location', {
        value: { search: '?debugPerf=1' },
        writable: true,
      });

      // Mock window.__perf
      const mockAddEvent = vitest.fn();
      (window as any).__perf = { addEvent: mockAddEvent };

      const bulletId = adapter.fire({
        sourceShipId: 1,
        turretId: 'main',
        targetPosition: { x: 100, y: 0, z: 0 },
      });

      expect(mockAddEvent).toHaveBeenCalledWith({
        name: 'projectile.fire.worker',
        ms: expect.any(Number),
      });

      mockAddEvent.mockClear();
      adapter.update(0.016);

      expect(mockAddEvent).toHaveBeenCalledWith({
        name: 'projectile.update.worker',
        ms: expect.any(Number),
      });

      expect(mockAddEvent).toHaveBeenCalledWith({
        name: 'projectile.count.worker',
        ms: 1, // One bullet
      });
    });
  });
});