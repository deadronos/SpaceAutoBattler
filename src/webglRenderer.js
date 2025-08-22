// webglrenderer.js - minimal WebGL2 renderer stub
export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    // this renderer may claim it owns its own loop in advanced impls
    this.providesOwnLoop = false;
  }
  init() {
    try {
      this.gl = this.canvas.getContext('webgl2');
      if (!this.gl) return false;
      // minimal setup
      const gl = this.gl;
      gl.clearColor(0.02, 0.03, 0.06, 1.0);
      return true;
    } catch (e) { return false; }
  }
  updateScale() {
    // Update viewport to match backing store size which may have changed
    // when the application adjusts canvas.width/height (e.g. DPR * scale)
    if (!this.gl) return;
    try {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } catch (e) { /* ignore */ }
  }
  isRunning() { return false; }
  renderState(state, interpolation = 0) {
    if (!this.gl) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // For simplicity this stub does not draw ships; fallback to CanvasRenderer if visual fidelity required.
  }
}

export default WebGLRenderer;
