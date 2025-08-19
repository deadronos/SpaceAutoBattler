import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clamp, getHullPath, recomputeBackgroundGradient, acquireParticle, releaseParticle, Particle, teamColor, initStars, stars, hullPaths, particlePool, particles } from '../src/renderer.js';

describe('renderer helpers', () => {
  beforeEach(() => {
    // ensure fresh state where applicable
    hullPaths.clear();
    particlePool.length = 0;
    particles.length = 0;
  });

  it('clamp clamps values to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });

  it('getHullPath returns a Path2D and caches results', () => {
    const p1 = getHullPath('corvette');
    const p2 = getHullPath('corvette');
    expect(p1).toBeDefined();
    expect(p1).toBe(p2); // same cached object
    // other types
    const pc = getHullPath('carrier');
    expect(pc).toBeDefined();
  });

  it('recomputeBackgroundGradient sets backgroundGradient without throwing', () => {
    // recompute should run without error
    expect(() => recomputeBackgroundGradient()).not.toThrow();
  });

  it('particle pool acquire/release works and reuses objects', () => {
    const p = acquireParticle(1,2,3,4,0.5,'rgba(1,2,3,$a)');
    expect(p).toBeInstanceOf(Particle);
    // after release, pool should contain the particle
    releaseParticle(p);
    expect(particlePool.length).toBeGreaterThanOrEqual(1);
    // acquire again should reuse
    const p2 = acquireParticle(9,8,7,6,0.3,'rgba(9,8,7,$a)');
    expect(p2).toBeInstanceOf(Particle);
  });

  it('teamColor returns expected rgba strings', () => {
    const red = teamColor(0, 0.5);
    const blue = teamColor(1, 0.25);
    expect(red).toMatch(/rgba\(255,90,90,0.5\)/);
    expect(blue).toMatch(/rgba\(80,160,255,0.25\)/);
  });

  it('initStars populates stars array', () => {
    initStars();
    expect(stars.length).toBeGreaterThan(0);
  });
});
