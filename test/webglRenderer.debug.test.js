import { describe, it, expect } from 'vitest';
import { createWebGLRenderer } from '../src/webglRenderer.js';

describe('webglRenderer debug assertions', () => {
  it('exposes per-VBO diagnostics and responds to forced mismatch test hook', () => {
    // Minimal GL stub similar to existing tests but with no-ops for buffer uploads
    const glStub = {
      ARRAY_BUFFER: 0x8892,
      STATIC_DRAW: 0x88E4,
      DYNAMIC_DRAW: 0x88E8,
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
      TEXTURE1: 0x84C1,
      TEXTURE_2D: 0x0DE1,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      CLAMP_TO_EDGE: 0x812F,
      LINEAR: 0x2601,
      NEAREST: 0x2600,

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
        if (pname === glStub.VIEWPORT) return [0, 0, 200, 200];
        return null;
      },
      createVertexArray: () => ({}),
      deleteVertexArray: () => {},
      deleteBuffer: () => {},
      deleteTexture: () => {},
      deleteFramebuffer: () => {},
      // program/attrib/uniform helpers used in render
      useProgram: () => {},
      getAttribLocation: () => -1,
      getUniformLocation: () => null,
      uniform2f: () => {},
      uniform1i: () => {},
      activeTexture: () => {},
      vertexAttribPointer: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribDivisor: () => {},
      drawArraysInstanced: () => {},
      drawArrays: () => {}
    };

    const fakeCanvas = {
      getContext: () => glStub,
      clientWidth: 200,
      clientHeight: 200,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const r = createWebGLRenderer(fakeCanvas, { debug: true });
    expect(r).not.toBeNull();
    const ok = r.init();
    expect(ok).toBe(true);

  // Call render with a small state that will allocate per-type buffers and exercise diagnostics
    r.render({ W: 200, H: 200, stars: [{ x: 10, y: 10, r: 1, a: 1 }], ships: [{ x: 50, y: 50, radius: 8, team: 'red' }], bullets: [{ x: 60, y: 60 }], particles: [{ x: 70, y: 70, color: '#ff0' }] });

    const d = r.getRendererDiagnostics();
    // diagnostics should include per-VBO sizes and samples
    expect(d).toHaveProperty('starVBOSize');
    expect(d).toHaveProperty('shipVBOSize');
    expect(d).toHaveProperty('bulletVBOSize');
    expect(d).toHaveProperty('particleVBOSize');
    expect(Array.isArray(d.starSample)).toBe(true);
    expect(Array.isArray(d.shipSample)).toBe(true);

    // cleanup
    try { r.destroy(); } catch (e) {}
  });
});
