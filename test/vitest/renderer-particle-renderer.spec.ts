import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import type { GameState } from '../../src/types/index.js';
import { createRNG } from '../../src/utils/rng.js';
import {
  initParticleRenderer,
  renderParticleSystem,
  disposeParticleRenderer,
} from '../../src/renderer/particleRenderer.js';
import { addParticleExplosion, ensureParticleSystem } from '../../src/renderer/particleSystem.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

describe('ParticleRenderer integration', () => {
  let state: GameState;
  let scene: THREE.Scene;
  let system: ReturnType<typeof ensureParticleSystem>;

  beforeEach(() => {
    scene = new THREE.Scene();
    state = {
      time: 0,
      tick: 0,
      running: true,
      speedMultiplier: 1,
      rng: createRNG('particle-renderer-test'),
      nextId: 1,
      ships: [],
      shipDataVersion: 1,
      bullets: [],
      score: { red: 0, blue: 0 },
      behaviorConfig: {} as any,
      simConfig: {
        seed: 'particle-renderer-seed',
        tickRate: 60,
        maxEntities: 1000,
        bulletLifetime: 3,
        maxSimulationSteps: 10,
        targetUpdateRate: 30,
        intentReevaluationRate: 1,
        boundaryBehavior: { ships: 'bounce', bullets: 'remove' },
        simBounds: { width: 1000, height: 1000, depth: 1000 },
        spatialGrid: { cellSize: 50 },
        useTimeBasedSeed: false,
      },
      assetPool: new Map(),
    } as unknown as GameState;

    initParticleRenderer({ state, scene });
    system = ensureParticleSystem(state);
    (system as unknown as { state: GameState }).state = state;
    system.update(10);
  });

  afterEach(() => {
    disposeParticleRenderer();
  });

  test('initializes instanced mesh with configured capacity', () => {
    const mesh = scene.children.find((child) => child instanceof THREE.InstancedMesh);
    expect(mesh).toBeDefined();
    const instancedMesh = mesh as THREE.InstancedMesh;
    expect(instancedMesh.count).toBe(0);
    expect(instancedMesh.visible).toBe(false);
    const positionAttr = instancedMesh.geometry.getAttribute('instancePosition');
    const seedAttr = instancedMesh.geometry.getAttribute('instanceSeed');
    expect(positionAttr).toBeDefined();
    expect(seedAttr).toBeDefined();
    expect(positionAttr?.count).toBe(RendererConfig.particles.explosion.pooling.initial);
    expect(seedAttr?.count).toBe(RendererConfig.particles.explosion.pooling.initial);
  });

  test('uploads particle data into instanced attributes', () => {
    addParticleExplosion(state, {
      pos: { x: 12, y: -4, z: 3 },
      radius: 5,
      seed: 99,
    });

    renderParticleSystem(0.016);

    const mesh = scene.children.find((child) => child instanceof THREE.InstancedMesh);
    expect(mesh).toBeDefined();
    const instancedMesh = mesh as THREE.InstancedMesh;
    expect(instancedMesh.visible).toBe(true);

    const activeInstances = system.getActiveInstances();
    expect(instancedMesh.count).toBe(activeInstances.length);
    expect(instancedMesh.count).toBeGreaterThan(0);

    const positionAttr = instancedMesh.geometry.getAttribute(
      'instancePosition',
    ) as THREE.InstancedBufferAttribute;
    const sizeAttr = instancedMesh.geometry.getAttribute(
      'instanceSize',
    ) as THREE.InstancedBufferAttribute;
    const ageAttr = instancedMesh.geometry.getAttribute(
      'instanceAge',
    ) as THREE.InstancedBufferAttribute;
    const seedAttr = instancedMesh.geometry.getAttribute(
      'instanceSeed',
    ) as THREE.InstancedBufferAttribute;

    expect(
      positionAttr.array.find(
        (value, index) => index < instancedMesh.count * 3 && Math.abs(value) > 1e-5,
      ),
    ).toBeDefined();
    expect(sizeAttr.array[0]).toBeGreaterThanOrEqual(RendererConfig.particles.explosion.size.min);
    expect(sizeAttr.array[0]).toBeLessThanOrEqual(RendererConfig.particles.explosion.size.max);
    expect(ageAttr.array[0]).toBeGreaterThan(0);
    expect(seedAttr.array[0]).toBeGreaterThanOrEqual(0);
    expect(seedAttr.array[0]).toBeLessThanOrEqual(1);

    renderParticleSystem(2.0);
    expect(instancedMesh.count).toBe(0);
    expect(instancedMesh.visible).toBe(false);
  });
});
