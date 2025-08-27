import { acquireBullet, releaseBullet, acquireExplosion, releaseExplosion, acquireShieldHit, releaseShieldHit, acquireHealthHit, releaseHealthHit, acquireParticle, releaseParticle, reset, } from "../src/gamemanager.js";
import { makeInitialState } from "../src/entities.js";
function stressTest(iterations = 1e6) {
    reset();
    const state = makeInitialState();
    for (let i = 0; i < iterations; i++) {
        const b = acquireBullet(state, { x: i });
        releaseBullet(state, b);
        const e = acquireExplosion(state, { x: i });
        releaseExplosion(state, e);
        const sh = acquireShieldHit(state, { x: i });
        releaseShieldHit(state, sh);
        const hh = acquireHealthHit(state, { x: i });
        releaseHealthHit(state, hh);
        const p = acquireParticle(state, i, i, { vx: i });
        releaseParticle(state, p);
        if (i % 1e5 === 0) {
            console.log(`Iteration ${i}`);
        }
    }
    console.log("Final pool sizes:", {
        bullets: (state.assetPool.sprites.get('bullet') || []).length,
        explosions: (state.assetPool.effects.get('explosion') || []).length,
        shieldHits: (state.assetPool.effects.get('shieldHit') || []).length,
        healthHits: (state.assetPool.effects.get('healthHit') || []).length,
        particles: (state.assetPool.effects.get('particle') || []).length,
    });
}
stressTest();
