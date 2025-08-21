import { describe, it, expect } from 'vitest';
import { createWebGLRenderer } from '../src/webglRenderer.js';

describe('webglRenderer (minimal)', () => {
  it('createWebGLRenderer returns null or object safely', () => {
    const fakeCanvas = { getContext: () => null };
    const r = createWebGLRenderer(fakeCanvas);
    expect(r === null || typeof r.init === 'function').toBe(true);
  });

  it('respects debug flag and exposes globals only when debug:true', () => {
    // Minimal WebGL stub sufficient for init() to run without full GPU
    const glStub = {
      // constants
      ARRAY_BUFFER: 0x8892,
      STATIC_DRAW: 0x88E4,
      VERTEX_SHADER: 0x8B31,
      FRAGMENT_SHADER: 0x8B30,
      COMPILE_STATUS: 0x8B81,
      LINK_STATUS: 0x8B82,
      ACTIVE_ATTRIBUTES: 0x8B89,
      ACTIVE_UNIFORMS: 0x8B86,
      TRIANGLE_STRIP: 0x0005,
      FLOAT: 0x1406,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      FRAMEBUFFER_COMPLETE: 0x8CD5,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,
      BLEND: 0x0BE2,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
      TEXTURE_2D: 0x0DE1,
      TEXTURE0: 0x84C0,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      CLAMP_TO_EDGE: 0x812F,
      LINEAR: 0x2601,
      NEAREST: 0x2600,

      // stateful no-op implementations
      getError: () => 0,
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      bufferSubData: () => {},
      createTexture: () => ({}),
      bindTexture: () => {},
      texImage2D: () => {},
      texParameteri: () => {},
      generateMipmap: () => {},
      pixelStorei: () => {},
      enable: () => {},
      disable: () => {},
      blendFunc: () => {},
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      getShaderInfoLog: () => '',
      deleteShader: () => {},
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: (p, pname) => {
        // return small defaults used by dumpProgramInfo
        if (pname === glStub.ACTIVE_ATTRIBUTES) return 0;
        if (pname === glStub.ACTIVE_UNIFORMS) return 0;
        if (pname === glStub.LINK_STATUS) return true;
        return 0;
      },
      getProgramInfoLog: () => '',
      deleteProgram: () => {},
      createFramebuffer: () => ({}),
      bindFramebuffer: () => {},
      framebufferTexture2D: () => {},
      checkFramebufferStatus: () => 0x8CD5,
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      finish: () => {},
      readPixels: () => {},
      getParameter: (pname) => {
        if (pname === glStub.BLEND) return false;
        return null;
      },
      createVertexArray: () => ({}),
      deleteVertexArray: () => {},
      deleteBuffer: () => {},
      deleteTexture: () => {},
      deleteFramebuffer: () => {}
    };

    const fakeCanvas = {
      getContext: () => glStub,
      clientWidth: 100,
      clientHeight: 100,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // ensure globals not present initially
    delete window.__getRendererDiagnostics;
    delete window.__renderer;

    const rDebug = createWebGLRenderer(fakeCanvas, { debug: true });
    expect(rDebug).not.toBeNull();
    // init should attach globals when debug:true
    const inited = rDebug.init();
    expect(inited).toBe(true);
    expect(typeof window.__getRendererDiagnostics).toBe('function');
    expect(window.__renderer).toBe(rDebug);

    // cleanup
    try { rDebug.destroy(); } catch (e) {}
    delete window.__getRendererDiagnostics;
    delete window.__renderer;

    const rNoDebug = createWebGLRenderer(fakeCanvas, { debug: false });
    expect(rNoDebug).not.toBeNull();
    const inited2 = rNoDebug.init();
    expect(inited2).toBe(true);
    // when debug:false the globals should not be attached
    expect(window.__getRendererDiagnostics).toBeUndefined();
    expect(window.__renderer).toBeUndefined();
    try { rNoDebug.destroy(); } catch (e) {}
  });
});
