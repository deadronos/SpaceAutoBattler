// @vitest-environment jsdom
import { beforeEach, test, expect, vi } from 'vitest';

// Mock RNG to be deterministic and simple for this unit test. We must mock
// before importing the renderer because renderer imports srange/srangeInt at
// module-eval time.
vi.mock('../src/rng.js', () => {
  return {
    srand: (s) => {},
    unseed: () => {},
    // deterministic: always return the lower bound for ranges
    srange: (a = 0, b = 1) => a,
    srangeInt: (a, b) => a,
  };
});

// Create a checkbox in the DOM so renderer picks it up as the static element
beforeEach(() => {
  // ensure a fresh jsdom document for each test and provide the minimal
  // DOM elements renderer expects at module-eval time.
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
  cb.checked = true; // enable reinforcement
  document.body.appendChild(cb);
  // Provide a minimal canvas 2D context mock so renderer can call
  // ctx.createRadialGradient and other APIs during module init.
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

test('handleReinforcement spawns deterministic reinforcements when enabled', async () => {
  const renderer = await import('../src/renderer.js');
  const entities = await import('../src/entities.js');
  const { Team } = entities;

  // start with a deterministic reset (spawnFleet will use mocked RNG)
  renderer.reset(12345);

  // Count initial blue ships
  const initialBlue = renderer.ships.filter(s => s.team === Team.BLUE).length;

  // Kill all blue ships to trigger reinforcement
  for (const s of renderer.ships) {
    if (s.team === Team.BLUE) s.alive = false;
  }

  // Reset cooldowns and run reinforcement (dt large enough to pass cooldown)
  renderer.resetReinforcementCooldowns();
  renderer.handleReinforcement(1.0);

  const afterBlue = renderer.ships.filter(s => s.team === Team.BLUE && s.alive).length;

  // With our mocked RNG (srangeInt returns the lower bound), the spawn count
  // for srangeInt(1,6) will be 1, so at least one blue ship should be alive.
  expect(afterBlue).toBeGreaterThanOrEqual(1);
  // Ensure we increased blue alive count compared to zero after kill
  expect(afterBlue).toBeGreaterThan(0);
});
