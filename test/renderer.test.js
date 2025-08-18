import { describe, it, expect, vi } from 'vitest';
import { teamColor, Particle, ShipV, render, initRendererUI } from '../src/renderer.js';
import { Team } from '../src/entities.js';

// Mock canvas context factory
function createMockCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), stroke: vi.fn(), clip: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), fillStyle: '', strokeStyle: '', lineWidth: 0, shadowBlur: 0, shadowColor: '', globalAlpha: 1, textAlign: '', font: '', clearRect: vi.fn(), textContent: '', fillText: vi.fn(), globalCompositeOperation: '' };
}

describe('Renderer (pure parts)', () => {
  it('teamColor returns correct rgba for teams', () => {
    expect(teamColor(Team.RED, 0.5)).toBe('rgba(255,90,90,0.5)');
    expect(teamColor(Team.BLUE, 0.25)).toBe('rgba(80,160,255,0.25)');
  });

  it('Particle.update moves and decays velocity and life', () => {
    const p = new Particle(0, 0, 10, 0, 1, 'rgba(0,0,0,$a)');
    p.update(0.5);
    expect(p.x).toBeCloseTo(5);
    expect(Math.abs(p.vx)).toBeLessThan(10);
    expect(p.life).toBeCloseTo(0.5);
  });

  it('Particle.draw uses ctx.fillRect when ctx is provided', () => {
    const ctx = createMockCtx();
    global.ctx = ctx;
    const p = new Particle(10, 20, 0, 0, 1, 'rgba(255,255,255,$a)');
    p.draw();
    expect(ctx.fillStyle).toMatch(/rgba\(255,255,255,1\.000\)/);
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 2, 2);
  });

  it('ShipV.syncFromLogic copies position and type from logic object', () => {
    const logic = { id: 42, x: 100, y: 120, type: 'frigate', alive: true };
    const sv = new ShipV(logic);
    logic.x = 200; logic.y = 220; logic.type = 'destroyer'; logic.alive = false;
    sv.syncFromLogic();
    expect(sv.x).toBe(200);
    expect(sv.y).toBe(220);
    expect(sv.type).toBe('destroyer');
    expect(sv.alive).toBe(false);
  });

  it('render is safe to call when no canvas context present', () => {
    expect(() => render()).not.toThrow();
  });

  it('initRendererUI is safe to call in non-DOM environment', () => {
    expect(() => initRendererUI()).not.toThrow();
  });
});

