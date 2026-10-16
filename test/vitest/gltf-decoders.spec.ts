import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

// Shared spies/state must be created with `vi.hoisted` because `vi.mock` factories are
// hoisted above the regular imports.
const h = vi.hoisted(() => ({
  setDecoderPath: vi.fn(),
  ktx2Instances: [] as Array<Record<string, unknown>>,
  failDetectSupport: false,
  failSetTranscoderPath: false,
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(), { setDecoderPath: h.setDecoderPath }),
}));

vi.mock('three-stdlib', () => {
  class KTX2Loader {
    setTranscoderPath = vi.fn(() => {
      if (h.failSetTranscoderPath) throw new Error('setTranscoderPath failed');
      return this;
    });
    detectSupport = vi.fn(() => {
      if (h.failDetectSupport) throw new Error('detectSupport failed');
      return this;
    });

    constructor() {
      h.ktx2Instances.push(this as unknown as Record<string, unknown>);
    }
  }
  return { KTX2Loader };
});

// Deterministic `?url` asset URLs so the derived directories match the production layout.
vi.mock('three/examples/jsm/libs/draco/draco_decoder.js?url', () => ({
  default: './decoders/draco_decoder.js',
}));
vi.mock('three/examples/jsm/libs/draco/draco_decoder.wasm?url', () => ({
  default: './decoders/draco_decoder.wasm',
}));
vi.mock('three/examples/jsm/libs/draco/draco_wasm_wrapper.js?url', () => ({
  default: './decoders/draco_wasm_wrapper.js',
}));
vi.mock('three/examples/jsm/libs/basis/basis_transcoder.js?url', () => ({
  default: './decoders/basis_transcoder.js',
}));
vi.mock('three/examples/jsm/libs/basis/basis_transcoder.wasm?url', () => ({
  default: './decoders/basis_transcoder.wasm',
}));

type DecoderModule = typeof import('../../src/renderer/loaders/gltfDecoders.js');

async function loadModule(): Promise<DecoderModule> {
  vi.resetModules();
  return import('../../src/renderer/loaders/gltfDecoders.js');
}

beforeEach(() => {
  vi.resetModules();
  h.setDecoderPath.mockClear();
  h.ktx2Instances.length = 0;
  h.failDetectSupport = false;
  h.failSetTranscoderPath = false;
});

describe('gltfDecoders', () => {
  it('registers a self-hosted Draco decoder path once at import time', async () => {
    const mod = await loadModule();

    expect(h.setDecoderPath).toHaveBeenCalledTimes(1);
    expect(h.setDecoderPath).toHaveBeenCalledWith(expect.stringMatching(/decoders\/$/));
    expect(mod.getDecoderDirs()).toEqual({ draco: './decoders/', basis: './decoders/' });
  });

  it('derives decoder dirs from .wasm URLs when dev pre-bundling turns .js?url into a function', async () => {
    // Vite's dev dependency optimizer pre-bundles `*.js?url`, so the import resolves to the
    // decoder factory function rather than a URL string. `.wasm?url` stays a string.
    vi.doMock('three/examples/jsm/libs/basis/basis_transcoder.js?url', () => ({
      default: function basisTranscoderFactory() {},
    }));
    vi.doMock('three/examples/jsm/libs/draco/draco_decoder.js?url', () => ({
      default: function dracoDecoderFactory() {},
    }));

    try {
      const mod = await loadModule();
      expect(mod.getDecoderDirs()).toEqual({ draco: './decoders/', basis: './decoders/' });
    } finally {
      vi.doMock('three/examples/jsm/libs/basis/basis_transcoder.js?url', () => ({
        default: './decoders/basis_transcoder.js',
      }));
      vi.doMock('three/examples/jsm/libs/draco/draco_decoder.js?url', () => ({
        default: './decoders/draco_decoder.js',
      }));
    }
  });

  it('initialises the KTX2 loader at most once (idempotent)', async () => {
    const mod = await loadModule();
    const gl = {} as never;

    mod.configureGltfDecoders(gl);
    mod.configureGltfDecoders(gl);

    expect(h.ktx2Instances).toHaveLength(1);
    expect(h.ktx2Instances[0]?.setTranscoderPath).toHaveBeenCalledWith('./decoders/');
  });

  it('does not throw when KTX2 support detection fails, and only checks once', async () => {
    h.failDetectSupport = true;
    const mod = await loadModule();
    const gl = {} as never;

    expect(() => mod.configureGltfDecoders(gl)).not.toThrow();
    expect(() => mod.configureGltfDecoders(gl)).not.toThrow();

    const instance = h.ktx2Instances[0] as { detectSupport: ReturnType<typeof vi.fn> };
    expect(instance.detectSupport).toHaveBeenCalledTimes(1);
  });

  it('falls back without throwing when KTX2 construction fails', async () => {
    h.failSetTranscoderPath = true;
    const mod = await loadModule();
    const gl = {} as never;

    expect(() => mod.configureGltfDecoders(gl)).not.toThrow();
    expect(() => mod.configureGltfDecoders(gl)).not.toThrow();

    const loader = { setKTX2Loader: vi.fn() };
    mod.extendShipGltfLoader(loader as never);
    expect(loader.setKTX2Loader).not.toHaveBeenCalled();
  });

  it('attaches KTX2 to the loader before configureGltfDecoders runs (render-phase timing)', async () => {
    const mod = await loadModule();
    const loader = { setKTX2Loader: vi.fn() };

    // `useGLTF` -> `useLoader` runs `extendLoader` during render, before `onCreated`.
    mod.extendShipGltfLoader(loader as never);

    expect(loader.setKTX2Loader).toHaveBeenCalledTimes(1);
    expect(loader.setKTX2Loader).toHaveBeenCalledWith(h.ktx2Instances[0]);

    // Detection still runs afterwards on the same instance, without throwing.
    expect(() => mod.configureGltfDecoders({} as never)).not.toThrow();
  });

  it('attaches the KTX2 loader to the glTF loader after configuration', async () => {
    const mod = await loadModule();
    mod.configureGltfDecoders({} as never);

    const loader = { setKTX2Loader: vi.fn() };
    mod.extendShipGltfLoader(loader as never);

    expect(loader.setKTX2Loader).toHaveBeenCalledTimes(1);
    expect(loader.setKTX2Loader).toHaveBeenCalledWith(h.ktx2Instances[0]);
  });
});
