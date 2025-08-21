// Minimal test setup for Vitest/jsdom environment
// Provide small stubs that some tests may rely on (OffscreenCanvas, Path2D, devicePixelRatio)
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class {
    constructor(w = 1, h = 1) { this.width = w; this.height = h; }
    getContext() { return null; }
  };
}
// jsdom: provide a minimal HTMLCanvasElement.getContext stub so tests that
// call document.createElement('canvas').getContext('2d') don't throw when
// the optional native 'canvas' package isn't installed.
if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  // Minimal constructor so `document.createElement('canvas') instanceof HTMLCanvasElement` may be false
  globalThis.HTMLCanvasElement = class {};
}
if (typeof HTMLCanvasElement.prototype.getContext === 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === '2d') {
      return {
        fillRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {},
        set fillStyle(v) {}, get fillStyle() { return '#000'; }
      };
    }
    return null;
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class {};
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.document === 'undefined') globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
if (typeof globalThis.devicePixelRatio === 'undefined') globalThis.devicePixelRatio = 1;

// no exports; side-effectful setup only
