// test/setupCanvas.js
// Provide a Node canvas to jsdom so HTMLCanvasElement.getContext('2d') works in tests
import { createCanvas } from 'canvas';

// jsdom will call window.HTMLCanvasElement.prototype.getContext, but in Node
// it is unimplemented. We polyfill it so that any created <canvas> element
// delegates to node-canvas.
if (typeof globalThis !== 'undefined' && typeof globalThis.HTMLCanvasElement !== 'undefined') {
  // Only patch if not already present
  if (!HTMLCanvasElement.prototype.getContext || HTMLCanvasElement.prototype.getContext.toString().includes('Not implemented')) {
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type !== '2d') return null;
      // create a real Canvas and copy size
      const c = createCanvas(this.width || 300, this.height || 150);
      return c.getContext('2d');
    };
  }
}
