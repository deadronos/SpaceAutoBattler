// Minimal WebGL renderer stub implementing createWebGLRenderer per spec.
export function createWebGLRenderer(canvas, opts = {}) {
  try {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || null;
    if (!gl) return null;
    return {
      type: 'webgl', webgl2: !!canvas.getContext('webgl2'),
      init() { return true; },
      start(cb) { if (cb) cb(); },
      stop() {},
      isRunning() { return false; },
      render(state) {},
      destroy() {}
    };
  } catch (e) {
    return null;
  }
}

export default { createWebGLRenderer };
