export type TransformSoALayout = {
  capacity: number;
  totalBytes: number;
  positionsOffset: number;
  rotationsOffset: number;
  scalesOffset: number;
  shipHpOffset: number;
  shipShieldOffset: number;
  shipThrustOffset: number;
};

function align4(bytes: number): number {
  return (bytes + 3) & ~3;
}

export function createTransformSoALayout(capacity: number): TransformSoALayout {
  const safeCapacity = Math.max(0, Math.floor(capacity));

  const positionsBytes = safeCapacity * 3 * 4;
  const rotationsBytes = safeCapacity * 4 * 4;
  const scalesBytes = safeCapacity * 1 * 4;
  const shipHpBytes = safeCapacity * 1 * 4;
  const shipShieldBytes = safeCapacity * 1 * 4;
  const shipThrustBytes = safeCapacity * 1 * 4;

  let offset = 0;
  const positionsOffset = offset;
  offset = align4(offset + positionsBytes);

  const rotationsOffset = offset;
  offset = align4(offset + rotationsBytes);

  const scalesOffset = offset;
  offset = align4(offset + scalesBytes);

  const shipHpOffset = offset;
  offset = align4(offset + shipHpBytes);

  const shipShieldOffset = offset;
  offset = align4(offset + shipShieldBytes);

  const shipThrustOffset = offset;
  offset = align4(offset + shipThrustBytes);

  const totalBytes = offset;

  return {
    capacity: safeCapacity,
    totalBytes,
    positionsOffset,
    rotationsOffset,
    scalesOffset,
    shipHpOffset,
    shipShieldOffset,
    shipThrustOffset,
  };
}

export type TransformSoAViews = {
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
  shipHp: Float32Array;
  shipShield: Float32Array;
  shipThrust: Float32Array;
};

export function createTransformSoAViews(
  layout: TransformSoALayout,
  buffer: ArrayBufferLike,
): TransformSoAViews {
  const { capacity } = layout;
  return {
    positions: new Float32Array(buffer, layout.positionsOffset, capacity * 3),
    rotations: new Float32Array(buffer, layout.rotationsOffset, capacity * 4),
    scales: new Float32Array(buffer, layout.scalesOffset, capacity),
    shipHp: new Float32Array(buffer, layout.shipHpOffset, capacity),
    shipShield: new Float32Array(buffer, layout.shipShieldOffset, capacity),
    shipThrust: new Float32Array(buffer, layout.shipThrustOffset, capacity),
  };
}
