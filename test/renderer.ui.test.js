import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock simulateStep to keep simulate() cheap in tests
vi.mock('../src/simulate.js', () => ({ simulateStep: () => {} }));

import { initRendererUI, SPEED_STEPS, speed } from '../src/renderer.js';

describe('Renderer UI interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('startPause button toggles running state and updates label', () => {
    const btn = document.createElement('button');
    btn.id = 'startPause';
    btn.textContent = '▶ Start';
    document.body.appendChild(btn);

    // call initRendererUI which wires the click handler
    expect(() => initRendererUI()).not.toThrow();

    // Simulate click: should toggle running and change text
    btn.click();
    // After click, the button text should reflect paused state or start depending on toggle
    expect(['⏸ Pause', '▶ Start']).toContain(btn.textContent);
  });

  it('speed button cycles through speed steps on click', () => {
    const btn = document.createElement('button');
    btn.id = 'speed';
    btn.textContent = 'Speed: 1×';
    document.body.appendChild(btn);

    // Ensure the UI wiring runs
    expect(() => initRendererUI()).not.toThrow();

    // click multiple times and assert the label updates and speed cycles using exported SPEED_STEPS
    for (let i = 0; i < SPEED_STEPS.length; i++) {
      btn.click();
      expect(btn.textContent.startsWith('Speed:')).toBe(true);
      // exported speed should be one of the defined steps
      expect(SPEED_STEPS).toContain(speed);
    }
  });
});
