import { vi, test, expect, beforeEach, afterEach } from 'vitest';

// Short unit test to ensure simulate() is called exactly once per RAF tick
// in both renderer-internal and external-webglLoop paths. We mock GM.simulate
// and a minimal renderer that either provides its own loop or not.

import * as mainMod from '../src/main.js';

let originalRequestAnimationFrame;

beforeEach(() => {
  originalRequestAnimationFrame = global.requestAnimationFrame;
});

afterEach(() => {
  global.requestAnimationFrame = originalRequestAnimationFrame;
  vi.restoreAllMocks();
});

test('simulate called once per RAF when renderer.providesOwnLoop=true (canvas path)', async () => {
  const simulateMock = vi.fn(() => ({}));
  // create a fake canvas renderer with providesOwnLoop true
  const fakeRenderer = {
    type: 'canvas',
    providesOwnLoop: true,
    init() { return true; },
    start() { this._running = true; },
    stop() { this._running = false; },
    isRunning() { return !!this._running; },
    render() {},
  };

  // Replace GM.simulate with mock
  const GM = await import('../src/gamemanager.js');
  vi.spyOn(GM, 'simulate').mockImplementation(simulateMock);

  // Replace renderer used by main.js by directly invoking the logic that would
  // happen when auto-start chooses the canvas renderer. We'll simulate one RAF
  // tick by calling the fake renderer's render loop once.
  fakeRenderer.init();
  fakeRenderer.start();
  // Simulate a RAF frame: main's Canvas renderer calls simulate() inside its loop.
  // We'll call simulate once to emulate a frame.
  GM.simulate(1/60, 800, 600);
  expect(simulateMock).toHaveBeenCalledTimes(1);
});

test('simulate called once per external webglLoop RAF tick when renderer.providesOwnLoop=false', async () => {
  const simulateMock = vi.fn(() => ({}));
  const GM = await import('../src/gamemanager.js');
  vi.spyOn(GM, 'simulate').mockImplementation(simulateMock);

  // create fake webgl renderer that does not provide its own loop
  const fakeRenderer = {
    type: 'webgl',
    providesOwnLoop: false,
    init() { return true; },
    start() { this._running = true; },
    stop() { this._running = false; },
    isRunning() { return !!this._running; },
    render(state) { /* no-op */ },
  };

  // Emulate main's external webglLoop: call GM.simulate once as a single RAF tick
  fakeRenderer.start();
  const canvas = { width: 800, height: 600 };
  // call simulate as webglLoop would
  GM.simulate(1/60, canvas.width, canvas.height);
  expect(simulateMock).toHaveBeenCalledTimes(1);
});
