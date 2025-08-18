import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock simulateStep before importing renderer so simulate() won't run heavy logic
vi.mock('../src/simulate.js', () => ({ simulateStep: () => {} }));

import { initRenderer, toast, ShipV, Particle, render, initRendererUI, simulate, ships, shipsVMap, levelFlashes, particles } from '../src/renderer.js';
import { Team } from '../src/entities.js';

function createMockCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), stroke: vi.fn(), clip: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), fillStyle: '', strokeStyle: '', lineWidth: 0, shadowBlur: 0, shadowColor: '', globalAlpha: 1, textAlign: '', font: '', clearRect: vi.fn(), fillText: vi.fn(), globalCompositeOperation: '' };
}

describe('Renderer extra coverage', () => {
  beforeEach(() => {
    // reset DOM area used by tests
    document.body.innerHTML = '';
    // reset module-global arrays
    particles.length = 0;
    levelFlashes.length = 0;
    ships.length = 0;
    shipsVMap.clear();
  });

  it('initRenderer binds to #world canvas and requests 2D context', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'world';
  // allow the real canvas/getContext behavior in jsdom; just ensure initRenderer runs
    document.body.appendChild(canvas);
    expect(() => initRenderer()).not.toThrow();
    // width should be set to window.innerWidth by initRenderer
    expect(canvas.width).toBe(window.innerWidth);
  });

  it('toast writes to #toast and toggles show class', async () => {
    vi.useFakeTimers();
    const t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
    toast('hello');
    expect(t.textContent).toBe('hello');
    expect(t.classList.contains('show')).toBe(true);
    // advance timers to remove the class
    vi.advanceTimersByTime(1500);
    expect(t.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });

  it('ShipV.draw executes drawing calls without throwing', () => {
    const mockCtx = createMockCtx();
    // provide a global ctx for ensureCtx path
    global.ctx = mockCtx;
    const logic = { id: 7, x: 120, y: 140, type: 'corvette', alive: true, radius: 8, angle: 0, shield: 10, shieldMax: 10, hp: 20, hpMax: 20, vx: 0, vy: 0 };
    const sv = new ShipV(logic);
    expect(() => sv.draw()).not.toThrow();
    // ensure some canvas operations ran
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('simulate triggers level-up flash and particle burst when ship level changes', () => {
    // set up a ship that will be detected as leveled (sv.level differs)
    const ship = { id: 99, x: 200, y: 200, level: 2, alive: true, shield: 0, shieldMax: 0, hp: 10, hpMax: 10, radius: 8, type: 'corvette', vx: 0, vy: 0, angle: 0 };
    ships.length = 0; ships.push(ship);
    const sv = new ShipV(ship);
    sv.level = 1; // older visual level
    shipsVMap.set(ship.id, sv);
    particles.length = 0;
    levelFlashes.length = 0;

    simulate(0.016);

    expect(levelFlashes.some(l => l.id === ship.id)).toBe(true);
    expect(particles.length).toBeGreaterThanOrEqual(18);
  });
});
