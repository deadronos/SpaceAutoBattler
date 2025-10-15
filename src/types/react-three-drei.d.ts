// Minimal ambient module declaration to satisfy TypeScript when @react-three/drei types are not installed.
// This file is intentionally small and only used for development typechecks in environments
// where the optional @react-three/drei package (dev dependency) isn't present.

declare module '@react-three/drei' {
  import * as React from 'react';
  import { GroupProps } from '@react-three/fiber';
  import type { Texture, Vector3 } from 'three';

  // lightweight stub for development typechecks
  export function useTexture(url: string): Texture;
  export function useTexture(urls: string[]): Texture[];
  export function useTexture<T extends Record<string, string>>(
    urls: T,
  ): { [K in keyof T]: Texture };
  export function useGLTF(path: string): unknown;
  // Material component from drei: https://drei.docs.pmnd.rs/shaders/mesh-transmission-material
  export const MeshTransmissionMaterial: React.FC<Record<string, unknown>>;
  export const Html: React.FC<GroupProps & { center?: boolean }>;
  // Common helpers used in this project
  export const OrbitControls: React.ComponentType<Record<string, unknown>>;
  export const Grid: React.ComponentType<Record<string, unknown>>;
  export interface LineProps extends Record<string, unknown> {
    points: Array<Vector3 | [number, number, number]>;
    color?: string;
    lineWidth?: number;
    children?: React.ReactNode;
  }
  export const Line: React.ComponentType<LineProps>;
  export interface BillboardProps extends GroupProps {
    follow?: boolean;
    lockX?: boolean;
    lockY?: boolean;
    lockZ?: boolean;
    children?: React.ReactNode;
    position?: Vector3 | [number, number, number];
  }
  export const Billboard: React.ComponentType<BillboardProps>;
  // Add other lightweight stubs here as needed by components.
  const _default: unknown;
  export default _default;
}
