// Minimal test setup for renderer tests
// Create a lightweight JSDOM document and real DOM elements for the renderer to attach to.
const { JSDOM } = await import('jsdom');

const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Do NOT overwrite globalThis.navigator directly (some environments make it a getter-only);
// accessing navigator via window.navigator will work because we set globalThis.window.

// Create a fake 2D context that implements the CanvasRenderingContext2D methods used
// by the renderer. We attach it to a real <canvas> element so addEventListener works.
const fakeCtx = {
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  arc: () => {},
  ellipse: () => {},
  fill: () => {},
  stroke: () => {},
  closePath: () => {},
  fillRect: () => {},
  clearRect: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  fillText: () => {},
  measureText: () => ({ width: 0 }),
  setLineDash: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  clip: () => {},
  // additional drawing helpers used by renderer
  shadowBlur: 0,
  shadowColor: '',
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'start',
  globalCompositeOperation: 'source-over',
};

// Create a real canvas element so DOM event listeners behave correctly
const canvas = document.createElement('canvas');
canvas.id = 'world';
canvas.width = 1024;
canvas.height = 768;
canvas.getContext = (type) => {
  if (type === '2d') return fakeCtx;
  return null;
};
document.body.appendChild(canvas);

// Create common UI elements the renderer expects so getElementById() returns
// real nodes with addEventListener and textContent support.
const ids = ['startPause','reset','addRed','addBlue','toggleTrails','speed','redScore','blueScore','stats','seedBtn','formationBtn','reinforceFreqBtn','toast'];
for (const id of ids) {
  if (!document.getElementById(id)) {
    const el = document.createElement(id === 'toast' ? 'div' : 'button');
    el.id = id;
    // badges/stats are spans/divs rather than buttons
    if (['redScore','blueScore','stats'].includes(id)) {
      const span = document.createElement('div'); span.id = id; span.textContent = '';
      document.body.appendChild(span);
      continue;
    }
    // default text for buttons
    el.textContent = id;
    document.body.appendChild(el);
  }
}

// Provide a fallback continuousCheckbox input if the renderer queries it
if (!document.getElementById('continuousCheckbox')) {
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'continuousCheckbox';
  // leave unchecked by default
  document.body.appendChild(cb);
}

// Do not define a minimal Path2D here; prefer the renderer's Path2D shim when
// running in the test environment so tests exercise the same helper.
if (typeof globalThis.Path2D === 'undefined') {
  // This is intentionally left out to use the renderer's Path2D.
}
