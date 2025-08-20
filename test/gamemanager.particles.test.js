import { describe, it, expect } from 'vitest';
import * as GM from '../src/gamemanager.js';
import { createCanvasRenderer } from '../src/renderer.js';

describe('gamemanager particle pool', () => {
  it('acquireParticle returns Particle and releaseParticle returns it to pool', () => {
    GM.reset(1);
    const beforePool = GM.particlePool.length;
    const p = GM.acquireParticle(10, 20, { vx: 1, vy: 2, ttl: 0.1, color: '#f00', size: 3 });
    expect(p).toHaveProperty('x', 10);
    expect(GM.particles.includes(p)).toBe(true);
    GM.releaseParticle(p);
    expect(GM.particlePool.length).toBeGreaterThanOrEqual(beforePool + 1);
  });
});

describe('flash life decay', () => {
  it('shieldFlashes and healthFlashes persist and decay across simulate/render frames', () => {
    GM.reset(2);
    // manually push a shield and health flash
    GM.shieldFlashes.push({ hitX: 50, hitY: 60, ttl: 0.2, life: 0.2, spawned: false, radius: 5 });
    GM.healthFlashes.push({ hitX: 70, hitY: 80, ttl: 0.3, life: 0.3, spawned: false, radius: 6 });
    // simulate a few small frames by calling GM.simulate (which merges nothing) and using renderer's renderOnce
    // create a fake canvas + 2D context with the drawing methods used by renderer
    const fakeCtx = {
      clearRect() {},
      fillRect() {},
      beginPath() {},
      arc() {},
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      set fillStyle(v) {},
      set strokeStyle(v) {},
      set lineWidth(v) {},
      set globalAlpha(v) {},
    };
    const canvas = { clientWidth: 200, clientHeight: 200, width: 200, height: 200, getContext: () => fakeCtx };
  const r = createCanvasRenderer(canvas);
  // initial: both arrays have items
  expect(GM.shieldFlashes.length).toBe(1);
  expect(GM.healthFlashes.length).toBe(1);
  const origShieldLife = GM.shieldFlashes[0].life;
  const origHealthLife = GM.healthFlashes[0].life;
  // initialize renderer and call renderOnce twice with a larger dt to ensure decay
  if (typeof r.init === 'function') r.init();
  const t0 = performance.now();
  r.renderOnce(t0);
  // advance by 200ms to guarantee life reduction
  r.renderOnce(t0 + 200);
  // after some frames they should have decayed, been removed, or at least been marked spawned
  const shieldOk = GM.shieldFlashes.length === 0 || GM.shieldFlashes[0].life < origShieldLife || GM.shieldFlashes[0].spawned === true;
  const healthOk = GM.healthFlashes.length === 0 || GM.healthFlashes[0].life < origHealthLife || GM.healthFlashes[0].spawned === true;
  expect(shieldOk).toBe(true);
  expect(healthOk).toBe(true);
  });
});
