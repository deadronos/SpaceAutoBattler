// Minimal ambient module declaration to satisfy TypeScript when @react-three/drei types are not installed.
// This file is intentionally small and only used for development typechecks in environments
// where the optional @react-three/drei package (dev dependency) isn't present.

declare module '@react-three/drei' {
  import * as React from 'react';
  import { GroupProps } from '@react-three/fiber';
  import type { Texture } from 'three';

  // lightweight stub for development typechecks
  export function useTexture(url: string): Texture;
  export function useTexture(urls: string[]): Texture[];
  export function useTexture<T extends Record<string, string>>(
    urls: T,
  ): { [K in keyof T]: Texture };
  export function useGLTF(
    path: string | string[],
    useDraco?: boolean | string,
    useMeshopt?: boolean,
    extendLoader?: (loader: import('three-stdlib').GLTFLoader) => void,
  ): unknown;
  export namespace useGLTF {
    export function setDecoderPath(path: string): void;
  }
  // Material component from drei: https://drei.docs.pmnd.rs/shaders/mesh-transmission-material
  export const MeshTransmissionMaterial: React.FC<Record<string, unknown>>;
  export const Html: React.FC<GroupProps & { center?: boolean }>;
  // Common helpers used in this project
  export const OrbitControls: React.ComponentType<Record<string, unknown>>;
  export const Grid: React.ComponentType<Record<string, unknown>>;
  // FPS-driven quality monitor used by QualityController (auto quality preset).
  export interface PerformanceMonitorApi {
    fps: number;
    factor: number;
    refreshrate: number;
    frames: number[];
    averages: number[];
    index: number;
    flipped: number;
    fallback: boolean;
  }
  export const PerformanceMonitor: React.ComponentType<{
    ms?: number;
    iterations?: number;
    threshold?: number;
    flipflops?: number;
    factor?: number;
    step?: number;
    onIncline?: (api: PerformanceMonitorApi) => void;
    onDecline?: (api: PerformanceMonitorApi) => void;
    onChange?: (api: PerformanceMonitorApi) => void;
    onFallback?: (api: PerformanceMonitorApi) => void;
    children?: React.ReactNode;
  }>;
  // Add other lightweight stubs here as needed by components.
  const _default: unknown;
  export default _default;
}
