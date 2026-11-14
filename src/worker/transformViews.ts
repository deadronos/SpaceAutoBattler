import type { TransformSoAViews } from './transformsLayout.js';

/** Copy occupied slots from the slot allocator. Both buffers share the allocator capacity. */
export function copyTransformViews(
  src: TransformSoAViews,
  dst: TransformSoAViews,
  slots: Iterable<number>,
): void {
  for (const slot of slots) {
    const position = slot * 3;
    dst.positions[position] = src.positions[position]!;
    dst.positions[position + 1] = src.positions[position + 1]!;
    dst.positions[position + 2] = src.positions[position + 2]!;

    const rotation = slot * 4;
    dst.rotations[rotation] = src.rotations[rotation]!;
    dst.rotations[rotation + 1] = src.rotations[rotation + 1]!;
    dst.rotations[rotation + 2] = src.rotations[rotation + 2]!;
    dst.rotations[rotation + 3] = src.rotations[rotation + 3]!;

    dst.scales[slot] = src.scales[slot]!;
    dst.shipHp[slot] = src.shipHp[slot]!;
    dst.shipShield[slot] = src.shipShield[slot]!;
    dst.shipThrust[slot] = src.shipThrust[slot]!;
  }
}
