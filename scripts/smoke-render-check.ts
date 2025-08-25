// Headless smoke test to ensure CanvasRenderer.renderState runs without runtime errors
// Uses a minimal DOM via happy-dom and ts-node to import TypeScript sources directly.

const { Window: HappyWindow } = require('happy-dom');
import { CanvasRenderer } from '../src/canvasrenderer';
import { makeInitialState } from '../src/entities';
import type { GameState } from '../src/types';

async function run() {
  try {
  // Create a lightweight happy-dom Window and Document
  const win = new HappyWindow();
  // happy-dom Window exposes document and other DOM globals
  (global as any).window = win as any;
  (global as any).document = win.document as any;
    (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
    (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

    // Ensure a canvas#world exists in the document for renderer to attach
    let canvas = document.getElementById('world') as unknown as HTMLCanvasElement | null;
    if (!canvas) {
      const el = document.createElement('canvas');
      el.id = 'world';
      document.body.appendChild(el);
      canvas = el as unknown as HTMLCanvasElement;
    }
    const renderer = new CanvasRenderer(canvas);
    const inited = renderer.init();
    console.log('renderer.init() ->', inited);

    const state: GameState = makeInitialState();
    // Add a ship with hp and shield to test hp/shield bar drawing
    state.ships = state.ships || [];
    state.ships.push({
      id: 'smoke-ship',
      x: 100,
      y: 100,
      angle: 0,
      radius: 12,
      hp: 50,
      maxHp: 100,
      shield: 25,
      maxShield: 50,
      team: 'red',
    } as any);
    state.t = 0;

    // Call renderState to exercise the drawing path
    try {
      renderer.renderState(state, 0);
      console.log('renderState completed successfully');
      process.exit(0);
    } catch (renderErr) {
      console.error('renderState threw:', renderErr);
      process.exit(2);
    }
  } catch (err) {
    console.error('Smoke check failed:', err);
    process.exit(1);
  }
}

run();
