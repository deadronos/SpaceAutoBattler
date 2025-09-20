// Runtime patch to guard GLTFLoader.load against invalid URLs.
// This prevents three.js from throwing when callers accidentally pass
// undefined/null into GLTFLoader (extractUrlBase calls lastIndexOf on the URL).
// We keep this file small and isolated so it can be imported early from main.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Avoid double-patching in case this module is imported multiple times.
type LoaderProto = {
  load: (url: string | URL, onLoad?: (gltf: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) => void;
  __loadPatched?: boolean;
};

const proto = (GLTFLoader as unknown as { prototype: LoaderProto }).prototype;
if (!proto.__loadPatched) {
  const originalLoad = proto.load;

  proto.load = function patchedLoad(url: unknown, onLoad?: (gltf: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) {
    const isString = typeof url === 'string' && url.length > 0;
    const isURLObject = typeof URL !== 'undefined' && url instanceof URL;

    if (!isString && !isURLObject) {
      // Provide helpful debugging context where possible.
      try {
        console.warn('[patchGltfLoader] GLTFLoader.load called with invalid url:', url);
      } catch {
        // ignore console errors in constrained environments
      }

      if (typeof onError === 'function') {
        try {
          onError(new Error('GLTFLoader.load: invalid url argument'));
        } catch {
          // swallow errors from user-provided callback
        }
      }

      // Return early. GLTFLoader.load is not expected to return a Promise, so
      // we mirror that and return undefined.
      return undefined;
    }

    // Call the original loader for valid inputs.
    return originalLoad.call(this as unknown as object, url as string | URL, onLoad, onProgress, onError);
  };

  // Mark as patched
  proto.__loadPatched = true;
}

export {};
