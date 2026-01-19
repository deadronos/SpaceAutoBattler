# Engine integration (R3F + Rapier3D)

## Update loop

- Rapier3D runs on the main thread and is stepped from React Three Fiber’s `useFrame`.

## Separation of concerns

- Keep simulation state and rendering decoupled via ECS (Miniplex) and `GameState`.

## Assets and disposal

- GLTFs are cached via `@react-three/drei`’s `useGLTF`.
- Dispose any Three.js resources you create when appropriate.

## Performance

- Prefer pooling/re-use and LOD for distant objects.
- Avoid per-frame allocations in hot code paths.
