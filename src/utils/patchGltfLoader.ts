// Runtime patch to guard GLTFLoader.load against invalid URLs for both
// three/examples and three-stdlib implementations used by @react-three/drei.
import { GLTFLoader as ExamplesGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Import from three-stdlib root; some versions do not expose loader subpaths in package exports.

type LoaderProto = {
  load: (url: string | URL, onLoad?: (gltf: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) => void;
  __loadPatched?: boolean;
};

type LoaderCtor = { prototype: LoaderProto } | undefined;

function patchPrototype(ctor: LoaderCtor, tag: string): void {
  if (!ctor) return;
  const proto = ctor.prototype as LoaderProto | undefined;
  if (!proto || proto.__loadPatched) return;
  const originalLoad = proto.load;
  if (typeof originalLoad !== 'function') return;
  proto.load = function patchedLoad(url: unknown, onLoad?: (gltf: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) {
    const isString = typeof url === 'string' && url.length > 0;
    const isURLObject = typeof URL !== 'undefined' && url instanceof URL;
    if (!isString && !isURLObject) {
      try { console.warn(`[patchGltfLoader:${tag}] GLTFLoader.load invalid url:`, url); } catch (e) { void e; }
      if (typeof onError === 'function') {
        try { onError(new Error('GLTFLoader.load: invalid url argument')); } catch (e) { void e; }
      }
      return undefined as unknown as void;
    }
    return originalLoad.call(this as unknown as object, url as string | URL, onLoad, onProgress, onError);
  };
  proto.__loadPatched = true;
}

patchPrototype(ExamplesGLTFLoader as unknown as LoaderCtor, 'examples');

// Attempt to patch stdlib GLTFLoader via dynamic import so bundlers can resolve
// whichever path the installed version exposes.
async function patchStdlib(): Promise<void> {
  // Try common exports locations in order.
  const candidates = [
    'three-stdlib/loaders/GLTFLoader',
    'three-stdlib/loaders/GLTFLoader.js',
    'three-stdlib'
  ];
  for (const spec of candidates) {
    try {
      const mod: unknown = await import(/* @vite-ignore */ spec);
      const maybeCtor = (mod as { GLTFLoader?: LoaderCtor } | undefined)?.GLTFLoader;
      const ctor = maybeCtor as LoaderCtor;
      if (ctor) {
        patchPrototype(ctor, `stdlib:${spec}`);
        break;
      }
    } catch {
      // try next
    }
  }
}

// Fire-and-forget; patching stdlib is best-effort and idempotent.
void patchStdlib();

export {};
