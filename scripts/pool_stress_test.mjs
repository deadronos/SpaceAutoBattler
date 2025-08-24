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
  bulletPool,
  explosionPool,
  shieldHitPool,
  healthHitPool,
  particlePool,
} from "../src/gamemanager.js";

function stressTest(iterations = 1e6) {
  reset();
  for (let i = 0; i < iterations; i++) {
    const b = acquireBullet({ x: i });
    releaseBullet(b);
    const e = acquireExplosion({ x: i });
    releaseExplosion(e);
    const sh = acquireShieldHit({ x: i });
    releaseShieldHit(sh);
    const hh = acquireHealthHit({ x: i });
    releaseHealthHit(hh);
    const p = acquireParticle(i, i, { vx: i });
    releaseParticle(p);
    if (i % 1e5 === 0) {
      console.log(`Iteration ${i}`);
    }
  }
  console.log("Final pool sizes:", {
    bulletPool: bulletPool.length,
    explosionPool: explosionPool.length,
    shieldHitPool: shieldHitPool.length,
    healthHitPool: healthHitPool.length,
    particlePool: particlePool.length,
  });
}

stressTest();
