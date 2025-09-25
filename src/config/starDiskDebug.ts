import type { StarDiskShaderConfig, StarDiskPaletteOffsetsConfig, StarDiskPaletteColorOffsetConfig } from './environment.js';

export interface StarDiskDebugContext {
  shaderOverrides?: Partial<StarDiskShaderConfig>;
}

interface StarDiskDebugState {
  base?: StarDiskShaderConfig;
  merged?: StarDiskShaderConfig;
  overrides?: Partial<StarDiskShaderConfig>;
}

interface StarDiskDebugGlobal {
  __STAR_DISK_DEBUG__?: StarDiskDebugContext;
  __STAR_DISK_DEBUG_STATE__?: StarDiskDebugState;
}

const hasOwn = Object.prototype.hasOwnProperty;

function mergePaletteColor(
  base: StarDiskPaletteColorOffsetConfig | undefined,
  overrides: StarDiskPaletteColorOffsetConfig | undefined,
): StarDiskPaletteColorOffsetConfig | undefined {
  if (!overrides) {
    return base ? { ...base } : base;
  }
  if (!base) {
    return { ...overrides };
  }
  return { ...base, ...overrides };
}

function mergePaletteOffsets(
  base: StarDiskPaletteOffsetsConfig | undefined,
  overrides: StarDiskPaletteOffsetsConfig | undefined,
): StarDiskPaletteOffsetsConfig | undefined {
  if (!overrides) {
    return base ? { ...base } : base;
  }
  const merged: StarDiskPaletteOffsetsConfig = {
    ...base,
    ...overrides,
  };
  const paletteKeys: Array<keyof StarDiskPaletteOffsetsConfig> = ['core', 'primary', 'secondary'];
  for (const key of paletteKeys) {
    if (hasOwn.call(overrides, key)) {
      merged[key] = mergePaletteColor(base?.[key], overrides[key]);
    } else if (base && hasOwn.call(base, key)) {
      merged[key] = base[key];
    }
  }
  return merged;
}

export function getStarDiskDebugContext(): StarDiskDebugContext | undefined {
  const globalTarget = globalThis as StarDiskDebugGlobal;
  const context = globalTarget.__STAR_DISK_DEBUG__;
  if (context?.shaderOverrides) {
    const existing = globalTarget.__STAR_DISK_DEBUG_STATE__ ?? {};
    globalTarget.__STAR_DISK_DEBUG_STATE__ = {
      ...existing,
      overrides: { ...context.shaderOverrides },
    };
  }
  return context;
}

export function applyStarDiskDebugOverrides(
  base: StarDiskShaderConfig | undefined,
): StarDiskShaderConfig | undefined {
  const context = getStarDiskDebugContext();
  const overrides = context?.shaderOverrides;
  if (!overrides || Object.keys(overrides).length === 0) {
    const globalTarget = globalThis as StarDiskDebugGlobal;
    if (globalTarget.__STAR_DISK_DEBUG_STATE__) {
      delete globalTarget.__STAR_DISK_DEBUG_STATE__;
    }
    return base;
  }
  const merged = {
    ...(base ? { ...base } : {}),
    ...overrides,
  } as StarDiskShaderConfig;
  if (hasOwn.call(overrides, 'paletteOffsets')) {
    merged.paletteOffsets = mergePaletteOffsets(base?.paletteOffsets, overrides.paletteOffsets);
  } else if (base?.paletteOffsets) {
    merged.paletteOffsets = { ...base.paletteOffsets };
  }
  (globalThis as StarDiskDebugGlobal).__STAR_DISK_DEBUG_STATE__ = {
    base,
    overrides,
    merged,
  };
  return merged;
}
