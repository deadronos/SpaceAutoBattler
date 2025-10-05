export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureAtlasMetadata {
  width: number;
  height: number;
  regions: Record<string, AtlasRegion>;
}

export interface AtlasUvTransform {
  offset: [number, number];
  scale: [number, number];
}

export function computeAtlasUvTransform(
  atlas: TextureAtlasMetadata,
  key: string,
): AtlasUvTransform {
  const region = atlas.regions[key];
  if (!region) {
    throw new Error(`Texture atlas region "${key}" not found.`);
  }
  if (atlas.width <= 0 || atlas.height <= 0) {
    throw new Error('Texture atlas dimensions must be positive.');
  }
  const offset: [number, number] = [region.x / atlas.width, region.y / atlas.height];
  const scale: [number, number] = [region.width / atlas.width, region.height / atlas.height];
  return { offset, scale };
}

export function getAtlasRegion(atlas: TextureAtlasMetadata, key: string): AtlasRegion {
  const region = atlas.regions[key];
  if (!region) {
    throw new Error(`Texture atlas region "${key}" not found.`);
  }
  return region;
}

export function normaliseAtlasMetadata(atlas: TextureAtlasMetadata): TextureAtlasMetadata {
  if (!Number.isFinite(atlas.width) || !Number.isFinite(atlas.height)) {
    throw new Error('Texture atlas metadata width/height must be finite numbers.');
  }
  return {
    width: atlas.width,
    height: atlas.height,
    regions: { ...atlas.regions },
  };
}

