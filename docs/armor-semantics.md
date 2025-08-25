Armor semantics and tuning

Overview

- Armor is represented as an integer armor value on ship type configs (e.g., 0, 1, 2, 3).
- In the current implementation, each armor point reduces hull (HP) damage by 10%.
  - Example: armor = 1 => hull damage reduced by 10%
  - armor = 2 => hull damage reduced by 20%
  - armor = 3 => hull damage reduced by 30%

Behavior

- Shields are a separate pool (maxShield, shieldRegen). Incoming damage first reduces shields.
- Any overflow damage that reaches hull is reduced by the ship's armor multiplier.
- If shields are absent (maxShield = 0 or current shield = 0), incoming damage is reduced by armor directly.

Tuning guidance

- To make small ships fragile but fast, give them low armor (0) and relatively small shields.
- Medium ships typically get modest armor (1) and moderate shields.
- Large ships can have higher armor (2-3) and large shield pools; observe that armor scales linearly per point (10% per point).

How to change the scaling

- The armor multiplier is implemented in `src/simulate.ts`. To change the per-point reduction, update the armor multiplier constant there (currently 0.1 for 10% per point).

Notes

- This is a simple, predictable model that is easy to tune. If you want diminishing returns or a different curve, we can replace the linear mapping with a configurable function.

Size-derived motion/display defaults

- The codebase now exposes per-size defaults for a few motion/display fields as well:
  - `radius`, `turnRate`, `accel`, `maxSpeed` are provided via `SIZE_DEFAULTS` in `src/config/entitiesConfig.ts`.
  - These defaults are merged into a ship's effective config at spawn so a type that omits these values will receive sensible defaults based on its `size`.

Runtime configuration helpers

- Use `setSizeDefaults(size, patch)` to update a single size's defaults at runtime (useful in tests or tuning UIs).
- Use `setAllSizeDefaults(patch)` to apply the same patch to all size classes.

Example

```ts
import { setSizeDefaults } from './src/config/entitiesConfig';

// Make all ships slightly slower for performance testing
setSizeDefaults('small', { maxSpeed: 1800 });
```
