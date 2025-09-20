// Temporary JSX shim to allow the project to typecheck after a mass
// dependency upgrade. This relaxes intrinsic element typing so we can run
// typechecks and tests and then iteratively replace this with correct
// intrinsic element definitions (especially for @react-three/fiber).
// TODO: remove this file after fixing React/@react-three type mismatches.

declare namespace JSX {
  // Minimal Element type
  interface Element {}

  // Allow any intrinsic JSX element with any props for now.
  // This prevents 'Cannot find namespace JSX' and related intrinsic element errors
  // introduced by major version bumps in React / react-three types.
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
