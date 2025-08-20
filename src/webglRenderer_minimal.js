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
        
        // Basic GL setup
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        console.log('WebGL renderer initialized successfully');
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
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.02, 0.03, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      // For now, just clear the screen - no actual rendering
      // This ensures the WebGL context works but we fall back to 2D for actual drawing
    }
  };

  renderer.destroy = function() {
    if (gl) {
      // Cleanup GL resources
      gl = null;
    }
    running = false;
  };

  return renderer;
}