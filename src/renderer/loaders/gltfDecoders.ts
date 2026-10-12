import { useGLTF } from '@react-three/drei';
import { KTX2Loader } from 'three-stdlib';
import type { GLTFLoader } from 'three-stdlib';
import type { WebGLRenderer } from 'three';

// Decoder assets are imported as Vite `?url` assets so the bundler emits them next to the
// app. `draco_decoder.js`, `draco_wasm_wrapper.js` and `basis_transcoder.js` are referenced
// only to force emission; the loaders fetch them by fixed filename from the directory derived
// below. `vite.config.ts` maps `draco_*`/`basis_transcoder*` to `decoders/<name>` so these
// filenames stay stable (unhashed) in the production build.
import dracoDecoderJs from 'three/examples/jsm/libs/draco/draco_decoder.js?url';
import dracoDecoderWasm from 'three/examples/jsm/libs/draco/draco_decoder.wasm?url';
import dracoWasmWrapper from 'three/examples/jsm/libs/draco/draco_wasm_wrapper.js?url';
import basisTranscoderJs from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import basisTranscoderWasm from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';

/**
 * Every self-hosted decoder asset. Retained (and exported) so bundlers keep each emitted
 * file even though the loaders fetch them by fixed filename at runtime.
 */
export const DECODER_ASSETS = {
  dracoDecoderJs,
  dracoDecoderWasm,
  dracoWasmWrapper,
  basisTranscoderJs,
  basisTranscoderWasm,
} as const;

/**
 * Returns the directory portion of an asset URL, including the trailing slash.
 * Avoids `new URL(...)` base pitfalls under Vite's `base: './'`.
 */
const dirOf = (u: string): string => u.slice(0, u.lastIndexOf('/') + 1);

/**
 * Stable directory URLs for the self-hosted decoder assets. Exported so tests can assert
 * path derivation without constructing a renderer.
 */
export function getDecoderDirs(): { draco: string; basis: string } {
  return {
    draco: dirOf(DECODER_ASSETS.dracoDecoderWasm),
    basis: dirOf(DECODER_ASSETS.basisTranscoderJs),
  };
}

// Register drei's Draco decoder path once at module load — no renderer required. drei keeps
// its own DRACOLoader and fetches `draco_decoder.wasm`/`draco_decoder.js` from this directory,
// so the runtime no longer depends on the gstatic CDN.
useGLTF.setDecoderPath(getDecoderDirs().draco);

let ktx2Loader: KTX2Loader | null = null;

/**
 * Configure glTF decoders for the live renderer. Idempotent: the KTX2 loader is created at
 * most once. If KTX2 support detection fails we log and leave the loader unset, so
 * uncompressed assets keep loading through the normal fallback path.
 */
export function configureGltfDecoders(gl: WebGLRenderer): void {
  if (ktx2Loader) return;

  const ktx2 = new KTX2Loader().setTranscoderPath(getDecoderDirs().basis);
  try {
    ktx2.detectSupport(gl);
  } catch (error) {
    console.warn('[gltfDecoders] KTX2 support detection failed; continuing without KTX2.', error);
    return;
  }

  ktx2Loader = ktx2;
}

/**
 * drei `extendLoader` hook: attaches the shared KTX2 loader when it initialised successfully.
 * Draco and Meshopt are configured by drei itself.
 */
export function extendShipGltfLoader(loader: GLTFLoader): void {
  if (ktx2Loader) loader.setKTX2Loader(ktx2Loader);
}
