// Minimal ambient module declaration to satisfy TypeScript when @react-three/drei types are not installed.
// This file is intentionally small and only used for development typechecks in environments
// where the optional @react-three/drei package (dev dependency) isn't present.

declare module '@react-three/drei' {
  import * as React from 'react';
  import { GroupProps } from '@react-three/fiber';

  // lightweight stub for development typechecks
  export function useGLTF(path: string): any;
  export const Html: React.FC<GroupProps & { center?: boolean }>;
  // Add other lightweight stubs here as needed by components.
  const _default: unknown;
  export default _default;
}
