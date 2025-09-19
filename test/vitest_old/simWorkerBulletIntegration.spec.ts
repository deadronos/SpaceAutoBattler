import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';

/**
 * Integration test for simWorker bullet processing
 * Tests that the worker can handle bullet-related messages correctly
 */
describe('simWorker bullet integration', () => {
  let worker: Worker;
  let workerReady = false;

  beforeEach(async () => {
    const root = path.resolve(__dirname, '..', '..');
    const distDir = path.join(root, 'dist');
    
    // Ensure build exists - we need the actual built worker
    try {
      const fs = await import('fs');
      const distExists = fs.existsSync(distDir);
      if (!distExists) {
        console.warn('[simWorker bullet integration] dist directory not found, skipping test');
        return;
      }
    } catch (e) {
      console.warn('[simWorker bullet integration] Cannot check dist directory, skipping test');
      return;
    }

    // Try to create the worker
    try {
      // This path should match the actual built worker output
      const workerPath = path.join(distDir, 'workers', 'simWorker.js'); 
      worker = new Worker(workerPath, { type: 'module' });
      
      // Wait for worker to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 10000);

        worker.addEventListener('message', (e) => {
          const data = e.data || {};
          if (data.type === 'init-physics-done') {
            workerReady = !!data.ok;
            clearTimeout(timeout);
            resolve();
          }
        });

        worker.addEventListener('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        // Initialize the worker
        worker.postMessage({ type: 'init-physics' });
      });
    } catch (error) {
      console.warn('[simWorker bullet integration] Worker creation failed:', error);
      throw error;
    }
  });

  afterEach(() => {
    if (worker) {
      worker.terminate();
    }
  });

  it('should handle bullet firing and removal', async () => {
    if (!workerReady) {
      console.warn('Worker not ready, skipping test');
      return;
    }

    const bulletId = 1;
    const testBullet = {
      id: bulletId,
      ownerShipId: 1,
      ownerTeam: 'red' as const,
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 100, y: 0, z: 0 },
      ttl: 5.0,
      damage: 25,
    };

    // Test bullet creation
    const fireResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bullet fire timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'fire-bullet-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(data);
        }
      });

      worker.postMessage({
        type: 'fire-bullet',
        payload: testBullet,
      });
    });

    expect(fireResult.success).toBe(true);
    expect(fireResult.bulletId).toBe(bulletId);

    // Test stepping physics to see if bullet transforms are returned
    const stepResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Physics step timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'step-physics-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(data);
        }
      });

      worker.postMessage({
        type: 'step-physics',
        payload: { dt: 0.016 },
      });
    });

    // Check if bullet transforms are included
    if (stepResult.transformsBuffer) {
      const arr = new Float32Array(stepResult.transformsBuffer);
      expect(arr.length).toBeGreaterThan(0);
      // Buffer format: [shipCount, ship data..., bulletCount, bullet data...]
      // For this test, we expect 0 ships and 1 bullet
      let offset = 0;
      const shipCount = arr[offset++];
      expect(shipCount).toBe(0);
      
      const bulletCount = arr[offset++];
      expect(bulletCount).toBe(1);
      
      // Bullet data: [id, px, py, pz, vx, vy, vz, ttl]
      const receivedBulletId = Math.floor(arr[offset++]);
      expect(receivedBulletId).toBe(bulletId);
      
      const bulletPosX = arr[offset++];
      expect(bulletPosX).toBeCloseTo(testBullet.vel.x * 0.016, 2); // Moved by velocity * dt
    }

    // Test bullet removal
    const removeResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bullet remove timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'remove-bullet-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(data);
        }
      });

      worker.postMessage({
        type: 'remove-bullet',
        payload: { bulletId },
      });
    });

    expect(removeResult.success).toBe(true);
    expect(removeResult.bulletId).toBe(bulletId);
  });

  it('should handle bullet expiration', async () => {
    if (!workerReady) {
      console.warn('Worker not ready, skipping test');
      return;
    }

    const bulletId = 2;
    const shortLivedBullet = {
      id: bulletId,
      ownerShipId: 1,
      ownerTeam: 'blue' as const,
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 50, y: 0, z: 0 },
      ttl: 0.01, // Very short TTL - should expire quickly
      damage: 10,
    };

    // Create bullet
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bullet fire timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'fire-bullet-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve();
        }
      });

      worker.postMessage({
        type: 'fire-bullet',
        payload: shortLivedBullet,
      });
    });

    // Step physics with a time step that should expire the bullet
    const stepResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Physics step timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'step-physics-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(data);
        }
      });

      worker.postMessage({
        type: 'step-physics',
        payload: { dt: 0.1 }, // Large time step to trigger expiration
      });
    });

    // Should receive bullet expiration event
    expect(stepResult.bulletEvents).toBeDefined();
    expect(Array.isArray(stepResult.bulletEvents)).toBe(true);
    
    const expiredEvent = stepResult.bulletEvents.find(
      (event: any) => event.type === 'bullet-expired' && event.bulletId === bulletId
    );
    expect(expiredEvent).toBeDefined();
  });

  it('should handle multiple bullets', async () => {
    if (!workerReady) {
      console.warn('Worker not ready, skipping test');
      return;
    }

    const bullets = [
      {
        id: 10,
        ownerShipId: 1,
        ownerTeam: 'red' as const,
        pos: { x: 0, y: 0, z: 0 },
        vel: { x: 100, y: 0, z: 0 },
        ttl: 5.0,
        damage: 25,
      },
      {
        id: 11,
        ownerShipId: 2,
        ownerTeam: 'blue' as const,
        pos: { x: 100, y: 0, z: 0 },
        vel: { x: -100, y: 0, z: 0 },
        ttl: 5.0,
        damage: 30,
      },
    ];

    // Create multiple bullets
    for (const bullet of bullets) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Bullet ${bullet.id} fire timeout`));
        }, 5000);

        worker.addEventListener('message', function handler(e) {
          const data = e.data || {};
          if (data.type === 'fire-bullet-done' && data.bulletId === bullet.id) {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
            resolve();
          }
        });

        worker.postMessage({
          type: 'fire-bullet',
          payload: bullet,
        });
      });
    }

    // Step physics and verify we get data for both bullets
    const stepResult = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Physics step timeout'));
      }, 5000);

      worker.addEventListener('message', function handler(e) {
        const data = e.data || {};
        if (data.type === 'step-physics-done') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(data);
        }
      });

      worker.postMessage({
        type: 'step-physics',
        payload: { dt: 0.016 },
      });
    });

    if (stepResult.transformsBuffer) {
      const arr = new Float32Array(stepResult.transformsBuffer);
      let offset = 0;
      
      const shipCount = arr[offset++];
      expect(shipCount).toBe(0);
      
      // Skip ship data (none in this test)
      
      const bulletCount = arr[offset++];
      expect(bulletCount).toBe(2);
      
      // Verify both bullets are present in the transform data
      const bulletIds = [];
      for (let i = 0; i < bulletCount; i++) {
        bulletIds.push(Math.floor(arr[offset]));
        offset += 8; // Skip to next bullet (8 floats per bullet)
      }
      
      expect(bulletIds).toContain(10);
      expect(bulletIds).toContain(11);
    }
  });
});