declare module 'three-stdlib/loaders/GLTFLoader.js' {
  export class GLTFLoader {
    load(
      url: string | URL,
      onLoad?: (gltf: unknown) => void,
      onProgress?: (e: ProgressEvent) => void,
      onError?: (e: unknown) => void,
    ): void;
  }
}

// `three-stdlib`'s root `index.d.ts` re-exports its modules with extensionless
// specifiers, which TypeScript cannot resolve under `moduleResolution: node16`. Declare
// the two members the runtime imports from the package root so typechecks succeed.
declare module 'three-stdlib' {
  import type { LoadingManager, WebGLRenderer } from 'three';

  export class KTX2Loader {
    constructor(manager?: LoadingManager);
    setTranscoderPath(path: string): KTX2Loader;
    setWorkerLimit(limit: number): KTX2Loader;
    detectSupport(renderer: WebGLRenderer): KTX2Loader;
    dispose(): KTX2Loader;
  }

  export class GLTFLoader {
    setKTX2Loader(loader: KTX2Loader): GLTFLoader;
    load(
      url: string | URL,
      onLoad?: (gltf: unknown) => void,
      onProgress?: (e: ProgressEvent) => void,
      onError?: (e: unknown) => void,
    ): void;
  }
}
