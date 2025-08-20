import { describe, it, expect } from 'vitest';
import { createWebGLRenderer } from '../src/webglRenderer.js';

describe('webglRenderer (minimal)', () => {
  it('createWebGLRenderer returns null or object safely', () => {
    const fakeCanvas = { getContext: () => null };
    const r = createWebGLRenderer(fakeCanvas);
    expect(r === null || typeof r.init === 'function').toBe(true);
  });
});
