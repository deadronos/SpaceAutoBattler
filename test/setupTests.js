// Minimal test setup for Vitest/jsdom environment
// Provide small stubs that some tests may rely on (OffscreenCanvas, Path2D, devicePixelRatio)
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class {
    constructor(w = 1, h = 1) { this.width = w; this.height = h; }
    getContext() { return null; }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class {};
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.document === 'undefined') globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
if (typeof globalThis.devicePixelRatio === 'undefined') globalThis.devicePixelRatio = 1;

// no exports; side-effectful setup only
