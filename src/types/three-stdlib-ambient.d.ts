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
