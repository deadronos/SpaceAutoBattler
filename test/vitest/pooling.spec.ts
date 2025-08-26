import { describe, it, expect, beforeEach } from "vitest";
import {
  acquireBullet,
  releaseBullet,
  acquireExplosion,
  releaseExplosion,
  acquireShieldHit,
  releaseShieldHit,
  acquireHealthHit,
  releaseHealthHit,
  acquireParticle,
  releaseParticle,
  reset,
} from "../../src/gamemanager";
import { makeInitialState } from "../../src/entities";
import { acquireSprite, releaseSprite, acquireEffect, releaseEffect } from '../../src/pools';

describe("Object Pooling", () => {
  beforeEach(() => {
    reset();
    // create a fresh canonical state for tests
    // tests will create their own state instances when needed
  });

  it("recycles all expired bullets (leak detection)", () => {
  const state = makeInitialState();
  const b1 = acquireBullet(state, { x: 1 });
  const b2 = acquireBullet(state, { x: 2 });
  releaseBullet(state, b1);
  releaseBullet(state, b2);
  // freed entries should be present in the assetPool.effects/sprites free lists
  const spriteEntry = state.assetPool.sprites.get('bullet');
  expect(spriteEntry?.freeList.length ?? 0).toBe(2);
  expect((state.bullets || []).every((b: any) => !b.alive)).toBe(true);
  });

  it("prevents double-free of bullets (double-free detection)", () => {
  const state = makeInitialState();
  const b = acquireBullet(state, { x: 1 });
  releaseBullet(state, b);
  const spriteEntry = state.assetPool.sprites.get('bullet');
  const poolLen = spriteEntry?.freeList.length ?? 0;
  releaseBullet(state, b); // Should not add again
  expect((state.assetPool.sprites.get('bullet')?.freeList.length ?? 0)).toBe(poolLen);
  });

  it("releases all expired explosions (missed object detection)", () => {
  const state = makeInitialState();
  const e1 = acquireExplosion(state, { x: 1 });
  const e2 = acquireExplosion(state, { x: 2 });
  releaseExplosion(state, e1);
  releaseExplosion(state, e2);
  const effectEntry = state.assetPool.effects.get('explosion');
  expect(effectEntry?.freeList.length ?? 0).toBe(2);
  expect((state.explosions || []).every((f: any) => !f.alive)).toBe(true);
  });

  it("handles empty arrays (edge case)", () => {
  const state = makeInitialState();
  expect((state.assetPool.sprites.get('bullet')?.freeList.length ?? 0)).toBe(0);
  expect((state.bullets || []).length).toBe(0);
  expect((state.assetPool.effects.get('explosion')?.freeList.length ?? 0)).toBe(0);
  expect((state.explosions || []).length).toBe(0);
  });

  it("handles all expired objects (edge case)", () => {
  const state = makeInitialState();
  const b = acquireBullet(state, { x: 1 });
  releaseBullet(state, b);
  expect((state.assetPool.sprites.get('bullet')?.freeList.length ?? 0)).toBe(1);
  expect((state.bullets || []).every((b: any) => !b.alive)).toBe(true);
  });

  it("handles all valid objects (edge case)", () => {
  const state = makeInitialState();
  const b = acquireBullet(state, { x: 1 });
  expect(b.alive).toBe(true);
  expect((state.assetPool.sprites.get('bullet')?.freeList.length ?? 0)).toBe(0);
  });

  it("recycles shieldHits and healthHits", () => {
  const state = makeInitialState();
  const sh = acquireShieldHit(state, { x: 1 });
  releaseShieldHit(state, sh);
  expect((state.assetPool.effects.get('shieldHit')?.freeList.length ?? 0)).toBe(1);
  expect((state.shieldHits || []).length).toBe(0);
  const hh = acquireHealthHit(state, { x: 2 });
  releaseHealthHit(state, hh);
  expect((state.assetPool.effects.get('healthHit')?.freeList.length ?? 0)).toBe(1);
  expect((state.healthHits || []).length).toBe(0);
  });

  it("recycles particles", () => {
  const state = makeInitialState();
  const p = acquireParticle(state, 1, 2, { vx: 1 });
  releaseParticle(state, p);
  expect((state.assetPool.effects.get('particle')?.freeList.length ?? 0)).toBe(1);
  expect((state.particles || []).length).toBe(0);
  });

  it("prevents double-free for all pools", () => {
    const state = makeInitialState();
    const e = acquireExplosion(state, { x: 1 });
    releaseExplosion(state, e);
  const effectEntry = state.assetPool.effects.get('explosion');
  const poolLen = effectEntry?.freeList.length ?? 0;
  releaseExplosion(state, e);
  expect(state.assetPool.effects.get('explosion')?.freeList.length ?? 0).toBe(poolLen);
  const sh = acquireShieldHit(state, { x: 1 });
  releaseShieldHit(state, sh);
  const shEntry = state.assetPool.effects.get('shieldHit');
  const shPoolLen = shEntry?.freeList.length ?? 0;
  releaseShieldHit(state, sh);
  expect(state.assetPool.effects.get('shieldHit')?.freeList.length ?? 0).toBe(shPoolLen);
  const hh = acquireHealthHit(state, { x: 2 });
  releaseHealthHit(state, hh);
  const hhEntry = state.assetPool.effects.get('healthHit');
  const hhPoolLen = hhEntry?.freeList.length ?? 0;
  releaseHealthHit(state, hh);
  expect(state.assetPool.effects.get('healthHit')?.freeList.length ?? 0).toBe(hhPoolLen);
  const p = acquireParticle(state, 1, 2, { vx: 1 });
  releaseParticle(state, p);
  const pEntry = state.assetPool.effects.get('particle');
  const pPoolLen = pEntry?.freeList.length ?? 0;
  releaseParticle(state, p);
  expect(state.assetPool.effects.get('particle')?.freeList.length ?? 0).toBe(pPoolLen);
  });
});
