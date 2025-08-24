import { describe, it, expect, beforeEach } from "vitest";
import {
  acquireBullet,
  releaseBullet,
  bulletPool,
  bullets,
  acquireExplosion,
  releaseExplosion,
  explosionPool,
  flashes,
  acquireShieldHit,
  releaseShieldHit,
  shieldHitPool,
  shieldFlashes,
  acquireHealthHit,
  releaseHealthHit,
  healthHitPool,
  healthFlashes,
  acquireParticle,
  releaseParticle,
  particlePool,
  particles,
  reset,
} from "../../src/gamemanager";

describe("Object Pooling", () => {
  beforeEach(() => {
    reset();
    bulletPool.length = 0;
    bullets.length = 0;
    explosionPool.length = 0;
    flashes.length = 0;
    shieldHitPool.length = 0;
    shieldFlashes.length = 0;
    healthHitPool.length = 0;
    healthFlashes.length = 0;
    particlePool.length = 0;
    particles.length = 0;
  });

  it("recycles all expired bullets (leak detection)", () => {
    const b1 = acquireBullet({ x: 1 });
    const b2 = acquireBullet({ x: 2 });
    releaseBullet(b1);
    releaseBullet(b2);
    expect(bulletPool.length).toBe(2);
    expect(bullets.every((b) => !b.alive)).toBe(true);
  });

  it("prevents double-free of bullets (double-free detection)", () => {
    const b = acquireBullet({ x: 1 });
    releaseBullet(b);
    const poolLen = bulletPool.length;
    releaseBullet(b); // Should not add again
    expect(bulletPool.length).toBe(poolLen);
  });

  it("releases all expired explosions (missed object detection)", () => {
    const e1 = acquireExplosion({ x: 1 });
    const e2 = acquireExplosion({ x: 2 });
    releaseExplosion(e1);
    releaseExplosion(e2);
    expect(explosionPool.length).toBe(2);
    expect(flashes.every((f) => !f.alive)).toBe(true);
  });

  it("handles empty arrays (edge case)", () => {
    expect(bulletPool.length).toBe(0);
    expect(bullets.length).toBe(0);
    expect(explosionPool.length).toBe(0);
    expect(flashes.length).toBe(0);
  });

  it("handles all expired objects (edge case)", () => {
    const b = acquireBullet({ x: 1 });
    releaseBullet(b);
    expect(bulletPool.length).toBe(1);
    expect(bullets.every((b) => !b.alive)).toBe(true);
  });

  it("handles all valid objects (edge case)", () => {
    const b = acquireBullet({ x: 1 });
    expect(b.alive).toBe(true);
    expect(bulletPool.length).toBe(0);
  });

  it("recycles shieldHits and healthHits", () => {
    const sh = acquireShieldHit({ x: 1 });
    releaseShieldHit(sh);
    expect(shieldHitPool.length).toBe(1);
    expect(shieldFlashes.length).toBe(0);
    const hh = acquireHealthHit({ x: 2 });
    releaseHealthHit(hh);
    expect(healthHitPool.length).toBe(1);
    expect(healthFlashes.length).toBe(0);
  });

  it("recycles particles", () => {
    const p = acquireParticle(1, 2, { vx: 1 });
    releaseParticle(p);
    expect(particlePool.length).toBe(1);
    expect(particles.length).toBe(0);
  });

  it("prevents double-free for all pools", () => {
    const e = acquireExplosion({ x: 1 });
    releaseExplosion(e);
    const poolLen = explosionPool.length;
    releaseExplosion(e);
    expect(explosionPool.length).toBe(poolLen);
    const sh = acquireShieldHit({ x: 1 });
    releaseShieldHit(sh);
    const shPoolLen = shieldHitPool.length;
    releaseShieldHit(sh);
    expect(shieldHitPool.length).toBe(shPoolLen);
    const hh = acquireHealthHit({ x: 2 });
    releaseHealthHit(hh);
    const hhPoolLen = healthHitPool.length;
    releaseHealthHit(hh);
    expect(healthHitPool.length).toBe(hhPoolLen);
    const p = acquireParticle(1, 2, { vx: 1 });
    releaseParticle(p);
    const pPoolLen = particlePool.length;
    releaseParticle(p);
    expect(particlePool.length).toBe(pPoolLen);
  });
});
