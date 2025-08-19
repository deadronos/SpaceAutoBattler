// @vitest-environment jsdom
import { beforeEach, test, expect, vi } from 'vitest';

// Mock RNG to be deterministic: always return lower bound
vi.mock('../src/rng.js', () => ({
  srand: (s) => {},
  unseed: () => {},
  srange: (a = 0, b = 1) => a,
  srangeInt: (a, b) => a,
}));

beforeEach(() => {
  document.body.innerHTML = `
    <canvas id="world"></canvas>
    <button id="startPause"></button>
    <button id="reset"></button>
    <button id="addRed"></button>
    <button id="addBlue"></button>
    <button id="toggleTrails"></button>
    <div id="speed"></div>
    <div id="redScore"></div>
    <div id="blueScore"></div>
    <div id="stats"></div>
    <button id="seedBtn"></button>
    <button id="formationBtn"></button>
    <div id="toast"></div>
  `;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'continuousCheckbox';
  cb.checked = true;
  document.body.appendChild(cb);

  HTMLCanvasElement.prototype.getContext = function () {
    return {
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      ellipse: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      createImageData: () => ({}),
      getImageData: () => ({}),
      putImageData: () => {},
      createPattern: () => null,
    };
  };
});

test('per-team accumulator triggers reinforcements only after interval threshold', async () => {
  const renderer = await import('../src/renderer.js');
  const entities = await import('../src/entities.js');
  const { Team } = entities;

  // Reset to deterministic state
  renderer.reset(42);

  // Kill all blue ships so alive < 2
  for (const s of renderer.ships) if (s.team === Team.BLUE) s.alive = false;

  renderer.resetReinforcementCooldowns();

  // Set interval to 0.5s so renderer should only attempt reinforcements every 0.5s
  renderer.setReinforcementInterval(0.5);

  // Track alive blue ships before advancing time
  const before = renderer.ships.filter(s => s.team === Team.BLUE && s.alive).length;
  expect(before).toBe(0);

  // Advance time in small dt steps (0.1s) and assert no spawn until we've accumulated >= 0.5
  const dt = 0.1;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    // Advance reinforcement accumulators via public evaluate function
    renderer.evaluateReinforcement(dt);
    const now = renderer.ships.filter(s => s.team === Team.BLUE && s.alive).length;
    // Before crossing 0.5s (first 4 iterations total=0.4) there should be no spawn
    expect(now).toBe(0);
    total += dt;
  }

  // After crossing the threshold, call once more
  renderer.evaluateReinforcement(0.1);

  const after = renderer.ships.filter(s => s.team === Team.BLUE && s.alive).length;
  // With mocked RNG, spawn count is deterministic (1), so after should be >= 1
  expect(after).toBeGreaterThanOrEqual(1);
});
