// Basic WebGL renderer scaffold.
function createShader(gl, type, source) { 
  const s = gl.createShader(type); 
  gl.shaderSource(s, source); 
  gl.compileShader(s); 
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { 
    const err = gl.getShaderInfoLog(s); 
    gl.deleteShader(s); 
    throw new Error('Shader compile error: '+err); 
  } 
  return s; 
}

function createProgram(gl, vsSrc, fsSrc) { 
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc); 
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc); 
  const p = gl.createProgram(); 
  gl.attachShader(p, vs); 
  gl.attachShader(p, fs); 
  gl.linkProgram(p); 
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { 
    const err = gl.getProgramInfoLog(p); 
    gl.deleteProgram(p); 
    throw new Error('Program link error: '+err); 
  } 
  return p; 
}

export function createWebGLRenderer(canvas, opts = {}) {
  const { webgl2 = false } = opts;
  let gl = null;
  let running = false;

  const renderer = { 
    type: 'webgl',
    webgl2,
    init() {
      try {
        gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl');
        if (!gl) return;
        console.log('WebGL renderer initialized');
      } catch (e) {
        gl = null; 
        console.warn('WebGL init failed:', e.message || e);
      }
    },
    start(onReady) { 
      running = true; 
      if (typeof onReady === 'function') onReady(); 
    },
    stop() { 
      running = false; 
    },
    isRunning() { 
      return running; 
    },
    render(state) {
      if (!gl) return;
      // Basic render implementation
      gl.clearColor(0.02, 0.02, 0.03, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  };

  return renderer;
}