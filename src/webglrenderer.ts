// src/webglrenderer.ts - Minimal WebGL renderer stub ported from webglRenderer.js
// Provides a typed, minimal WebGL renderer so the rest of the app can opt-in.

export class WebGLRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  providesOwnLoop = false;
  type = 'webgl';
  pixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    try {
      // Prefer WebGL2, fall back to WebGL1
      this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (!this.gl) {
        this.gl = (this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!this.gl) return false;
      }
      const gl = this.gl as WebGLRenderingContext;
      gl.clearColor(0.02, 0.03, 0.06, 1.0);
      // compute pixelRatio to map logical (CSS) pixels to backing-store pixels
      try {
        const cssW = this.canvas.clientWidth || this.canvas.width || 1;
        this.pixelRatio = (this.canvas.width || cssW) / cssW;
      } catch (e) { this.pixelRatio = 1; }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Called when backing-store size (canvas.width/height) changes so
  // the renderer can update internal scaling/viewport without a full re-init.
  updateScale(): void {
    if (!this.gl) return;
    try {
      const cssW = this.canvas.clientWidth || Math.round((this.canvas.width || 1) / (this.pixelRatio || 1));
      this.pixelRatio = (this.canvas.width || cssW) / Math.max(1, cssW);
      // set viewport in logical/backing pixels on next render
    } catch (e) { /* ignore */ }
  }

  isRunning(): boolean { return false; }

  renderState(state: any, interpolation = 0): void {
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
    try {
  // viewport uses backing-store pixel dimensions (canvas.width/height)
  gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Minimal stub: no ship drawing here. Use CanvasRenderer for visuals.
    } catch (e) {
      // swallow GL render errors to avoid crashing the app
    }
  }
}

export default WebGLRenderer;
