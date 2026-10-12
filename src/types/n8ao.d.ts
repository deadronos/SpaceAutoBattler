// Minimal ambient module declaration for `n8ao`.
//
// The published package ships JavaScript only (no `.d.ts`), so TypeScript cannot
// infer its surface under `moduleResolution: node16`. Declare just the members the
// runtime imports (the `N8AOPostPass` class and the configuration shape we set).

declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three';
  import { Pass } from 'postprocessing';

  export type N8AOQualityMode = 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra';

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    halfRes: boolean;
    transparencyAware: boolean;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);

    scene: Scene;
    camera: Camera;
    width: number;
    height: number;
    configuration: N8AOConfiguration;

    setQualityMode(mode: N8AOQualityMode): void;
    setDisplayMode(mode: string): void;
    setSize(width: number, height: number): void;
  }
}
