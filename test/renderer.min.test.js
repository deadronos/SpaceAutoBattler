import { describe, it, expect } from 'vitest';
import { createCanvasRenderer } from '../src/renderer.js';

describe('renderer (minimal)', () => {
  it('createCanvasRenderer returns object with methods', () => {
    // create an offscreen canvas using jsdom via vitest environment
    const canvas = { clientWidth: 100, clientHeight: 100, style: {}, getContext: () => ({}) };
    const r = createCanvasRenderer(canvas);
    expect(typeof r.init).toBe('function');
    expect(typeof r.start).toBe('function');
    expect(typeof r.stop).toBe('function');
  });
});
