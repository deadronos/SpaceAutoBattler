import { describe, expect, it } from 'vite-plus/test';
import { captureProgramMetadata } from '../../src/renderer/webglDebugHooks.js';

const LINK_STATUS = 0x8b82;
const ACTIVE_UNIFORMS = 0x8b86;
const ACTIVE_ATTRIBUTES = 0x8b89;

function makeGl(overrides: Record<string, unknown> = {}): WebGL2RenderingContext {
  return {
    LINK_STATUS,
    ACTIVE_UNIFORMS,
    ACTIVE_ATTRIBUTES,
    getProgramParameter: (_p: unknown, pname: number) =>
      pname === LINK_STATUS ? true : pname === ACTIVE_UNIFORMS ? 2 : 1,
    getActiveUniform: (_p: unknown, i: number) => ({ name: `u${i}`, size: 1, type: 5126 }),
    getActiveAttrib: (_p: unknown, i: number) => ({ name: `a${i}`, size: 1, type: 5126 }),
    ...overrides,
  } as unknown as WebGL2RenderingContext;
}

describe('captureProgramMetadata', () => {
  it('captures link status, counts, uniforms and attributes', () => {
    const meta = captureProgramMetadata(makeGl(), {} as WebGLProgram);

    expect(meta.linkStatus).toBe(true);
    expect(meta.activeUniforms).toBe(2);
    expect(meta.activeAttributes).toBe(1);
    expect(meta.uniforms).toHaveLength(2);
    expect(meta.attributes).toHaveLength(1);
    expect(meta.uniforms[0]).toEqual({ name: 'u0', size: 1, type: 5126 });
  });

  it('records null for entries that throw', () => {
    const gl = makeGl({
      getActiveUniform: () => {
        throw new Error('boom');
      },
    });
    const meta = captureProgramMetadata(gl, {} as WebGLProgram);

    expect(meta.uniforms).toEqual([null, null]);
  });
});
