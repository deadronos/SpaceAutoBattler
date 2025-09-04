import type { GameState } from '../types/index.js';
import { createRNG } from '../utils/rng.js';
import { RendererConfig } from '../config/rendererConfig.js';

/**
 * ParticleSystem skeleton
 * - Provides addParticleExplosion(state, opts)
 * - Maintains a simple pool of ParticleInstance objects
 * - Uses state's RNG when available to generate deterministic initial values
 *
 * Note: This is a non-rendering, minimal skeleton focused on data and API.
 * Real rendering (Three.js instancing, buffer uploads, shader code) will be implemented
 * in subsequent steps.
 */

export type Vec3 = { x: number; y: number; z: number };

export interface ParticleExplosionOptions {
  pos: Vec3;
  radius: number;
  seed?: number;
  colorOverride?: string[];
  count?: number;
  lifetime?: number;
}

export interface ParticleInstance {
  id: number;
  pos: Vec3;
  vel: Vec3;
  size: number;
  age: number;
  lifetime: number;
  color: string;
  active: boolean;
}

export class ParticleSystem {
  private state: GameState;
  private pool: ParticleInstance[] = [];
  private active: Set<number> = new Set();
  private nextId = 1;

  constructor(state: GameState, poolSize = 256) {
    this.state = state;
    this.ensurePool(poolSize);
  }

  private ensurePool(size: number) {
    while (this.pool.length < size) {
      this.pool.push(this.createInstance());
    }
  }

  private createInstance(): ParticleInstance {
    return {
      id: this.nextId++,
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      size: 1,
      age: 0,
      lifetime: 1,
      color: '#ffffff',
      active: false,
    };
  }

  // Simple allocator: find first inactive instance
  private allocate(): ParticleInstance | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }

  // Public API called by game code
  public addParticleExplosion(opts: ParticleExplosionOptions) {
    const cfg = RendererConfig.particles.explosion;
    if (!cfg || !cfg.enabled) return;

    // Build a deterministic seed string using global seed + optional per-explosion seed
    const globalSeed = this.state.rng?.seed ?? this.state.simConfig?.seed ?? '0';
    const timePart = Math.floor((this.state.time ?? 0) * 1000);
    const seedStr = typeof opts.seed === 'number' ? `${globalSeed}:${opts.seed}` : `${globalSeed}:${timePart}`;
    const rng = createRNG(seedStr);

    const countBase = Math.round(cfg.countPerRadius * Math.max(1, opts.radius));
    const count = Math.max(cfg.minCount, Math.min(cfg.maxCount, opts.count ?? countBase));

    for (let i = 0; i < count; i++) {
      let instance = this.allocate();
      if (!instance) {
        // Try to grow the pool up to configured maximum, then retry allocation once
        const current = this.pool.length;
        const target = Math.min(Math.max(current * 2, current + 1), cfg.pooling.growTo);
        if (target > current) {
          this.ensurePool(target);
          instance = this.allocate();
        }
      }
      if (!instance) {
        // Pool exhausted and cannot grow further - gracefully stop spawning
        break;
      }
      instance.active = true;
      instance.age = 0;
      instance.lifetime = opts.lifetime ?? cfg.lifetime;

      // position: uniformly sample inside a sphere of given radius
      const theta = rng.next() * Math.PI * 2;
      const phi = Math.acos(1 - 2 * rng.next());
      const r = rng.next() * opts.radius;
      instance.pos = {
        x: opts.pos.x + r * Math.sin(phi) * Math.cos(theta),
        y: opts.pos.y + r * Math.sin(phi) * Math.sin(theta),
        z: opts.pos.z + r * Math.cos(phi),
      };

      // velocity: radial direction with some randomized spread
      const speed = rng.next() * (cfg.velocity.radial.max - cfg.velocity.radial.min) + cfg.velocity.radial.min;
      const spread = cfg.velocity.randomSpread;
      const dirX = instance.pos.x - opts.pos.x;
      const dirY = instance.pos.y - opts.pos.y;
      const dirZ = instance.pos.z - opts.pos.z;
      instance.vel = {
        x: dirX * speed * (1 + (rng.next() - 0.5) * spread),
        y: dirY * speed * (1 + (rng.next() - 0.5) * spread),
        z: dirZ * speed * (1 + (rng.next() - 0.5) * spread),
      };

      const t = rng.next();
      const colors = opts.colorOverride && opts.colorOverride.length > 0 ? opts.colorOverride : cfg.colors;
      instance.color = colors[Math.floor(t * colors.length)];
      instance.size = rng.next() * (cfg.size.max - cfg.size.min) + cfg.size.min;
      this.active.add(instance.id);
    }
  }

  // Called each frame by renderer loop to advance and recycle particles
  public update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.lifetime) {
        p.active = false;
        this.active.delete(p.id);
        continue;
      }
      // simple physics integration (placeholder)
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
    }
  }

  // Expose pool stats for debug
  public stats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      freeCount: this.pool.length - this.active.size,
    };
  }
}

// Singleton helper pattern: renderer can instantiate and reuse
let _system: ParticleSystem | null = null;
export function ensureParticleSystem(state: GameState) {
  if (!_system) _system = new ParticleSystem(state, RendererConfig.particles.explosion.pooling.initial);
  return _system;
}

export function addParticleExplosion(state: GameState, opts: ParticleExplosionOptions) {
  const sys = ensureParticleSystem(state);
  sys.addParticleExplosion(opts);
}
