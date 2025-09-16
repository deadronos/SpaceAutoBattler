declare module 'three/examples/jsm/controls/OrbitControls' {
  // Minimal declaration used in tests; actual module is mocked in Vitest
  export class OrbitControls {
    constructor(camera: unknown, domElement: unknown);
    update(): void;
    addEventListener(name: string, fn: (...args: any[]) => void): void;
    removeEventListener(name: string, fn: (...args: any[]) => void): void;
    dispose(): void;
    // allow any extra props in mocks
    [key: string]: any;
  }
}
