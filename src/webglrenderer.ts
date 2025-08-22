// src/webglrenderer.ts - Minimal WebGL renderer stub ported from webglRenderer.js
// Provides a typed, minimal WebGL renderer so the rest of the app can opt-in.

export class WebGLRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  providesOwnLoop = false;
  type = 'webgl';

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
      return true;
    } catch (e) {
      return false;
    }
  }

  isRunning(): boolean { return false; }

  renderState(state: any, interpolation = 0): void {
    if (!this.gl) return;
    const gl = this.gl as WebGLRenderingContext;
    try {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Minimal stub: no ship drawing here. Use CanvasRenderer for visuals.
    } catch (e) {
      // swallow GL render errors to avoid crashing the app
    }
  }
}

export default WebGLRenderer;
