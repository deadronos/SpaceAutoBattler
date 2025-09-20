// Compatibility shim for JSX types after upgrading to React 19 / new @types/react
// This maps the legacy `JSX.Element` to React's `ReactElement` and provides a
// permissive `IntrinsicElements` shape. It's temporary and should be removed
// once the codebase is updated to the newer typing expectations.

import type React from 'react';

declare global {
  // Ensure the JSX namespace exists and maps Element to React's element type.
  // This prevents errors where function components typed to return `JSX.Element`
  // are incompatible with React's newer types.
  namespace JSX {
    // Map JSX.Element to React.ReactNode so function components returning
    // elements are accepted as valid component return types with React 19.
    type Element = React.ReactNode;

    // Permissive IntrinsicElements so existing JSX intrinsic usages typecheck.
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
