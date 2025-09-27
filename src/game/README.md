# World configuration

The simulation uses a cubic world centered at the origin.

- WORLD_SIZE: length of a cube edge (default 8000)
- WORLD_HALF: half-extent (±4000 by default)
- clampToWorld(v): clamps a position to stay within the cube
- CAMERA_DEFAULTS / FOG_DEFAULTS: tuned defaults for the larger scale

Rendering uses @react-three/drei helpers like OrbitControls and Grid. You can
override camera and controls as needed in `components/Battlefield.tsx`.
