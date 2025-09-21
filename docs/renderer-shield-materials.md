# Renderer Shield Materials

This project now supports two shield materials:

- hex (default): Custom hex-grid shader with ripple effects.
- transmission: Drei's MeshTransmissionMaterial for glass-like shields.

## Configure per hull

Edit `src/config/renderer.ts` `SHIELD_VISUALS` entries per hull and set:

```ts
materialKind: 'transmission';
```

Optional transmission parameters (with defaults):

- thickness, chromaticAberration, anisotropicBlur, distortion, distortionScale, temporalDistortion,
  attenuationDistance, roughness, clearcoat, ior.

Example:

```ts
export const SHIELD_VISUALS = {
  fighter: {
    materialKind: 'transmission',
    maxAlpha: 0.4,
    transmission: { ior: 1.25, roughness: 0.08 },
  },
  // ...
};
```

You can also programmatically override for all hulls via:

```ts
import { setGlobalShieldMaterial } from '../config/renderer.js';
setGlobalShieldMaterial('transmission');
```

Notes:

- Simulation determinism is preserved; this is purely visual. All state remains in `GameState`.
- Opacity still maps to shield ratio (clamped by `maxAlpha`).
- MeshTransmissionMaterial is imported from `@react-three/drei` and typed via a local stub.

## Registry usage for other visuals

Materials are resolved from `src/renderer/materialRegistry.tsx` using namespaced keys. Built-ins include:

- `shield:hex`, `shield:transmission`
- `bullet:laser`
- `explosion:smoke`

To add your own:

```ts
registerMaterial('bullet:plasma', PlasmaBulletMaterial);
// then in your component
const Mat = getMaterial('bullet:plasma') ?? getMaterial('bullet:laser');
```
