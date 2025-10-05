export interface TextureAtlasRegion {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  uvOffset: readonly [number, number];
  uvScale: readonly [number, number];
}

export interface UVTransform {
  offset: readonly [number, number];
  scale: readonly [number, number];
}

export class TextureAtlasBuilder {
  private readonly regions = new Map<string, TextureAtlasRegion>();
  private cursorX = 0;
  private cursorY = 0;
  private rowHeight = 0;

  constructor(
    private readonly atlasWidth: number,
    private readonly atlasHeight: number,
    private readonly padding = 1,
  ) {
    if (atlasWidth <= 0 || atlasHeight <= 0) {
      throw new Error('TextureAtlasBuilder dimensions must be positive');
    }
  }

  add(key: string, width: number, height: number): TextureAtlasRegion {
    if (this.regions.has(key)) {
      throw new Error(`TextureAtlasBuilder already contains key "${key}"`);
    }

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('TextureAtlasBuilder requires positive finite region sizes');
    }

    if (width > this.atlasWidth || height > this.atlasHeight) {
      throw new Error('Region size exceeds atlas dimensions');
    }

    const paddedWidth = Math.ceil(width);
    const paddedHeight = Math.ceil(height);

    if (this.cursorX + paddedWidth > this.atlasWidth) {
      this.cursorX = 0;
      this.cursorY += this.rowHeight + this.padding;
      this.rowHeight = 0;
    }

    if (this.cursorY + paddedHeight > this.atlasHeight) {
      throw new Error('TextureAtlasBuilder ran out of vertical space');
    }

    const region: TextureAtlasRegion = {
      key,
      x: this.cursorX,
      y: this.cursorY,
      width: paddedWidth,
      height: paddedHeight,
      uvOffset: [this.cursorX / this.atlasWidth, this.cursorY / this.atlasHeight],
      uvScale: [paddedWidth / this.atlasWidth, paddedHeight / this.atlasHeight],
    };

    this.regions.set(key, region);
    this.cursorX += paddedWidth + this.padding;
    if (paddedHeight > this.rowHeight) {
      this.rowHeight = paddedHeight;
    }

    return region;
  }

  build(): TextureAtlas {
    return new TextureAtlas(this.atlasWidth, this.atlasHeight, new Map(this.regions));
  }
}

export class TextureAtlas {
  constructor(
    public readonly width: number,
    public readonly height: number,
    private readonly regions: Map<string, TextureAtlasRegion>,
  ) {}

  getRegion(key: string): TextureAtlasRegion {
    const region = this.regions.get(key);
    if (!region) {
      throw new Error(`TextureAtlas missing region for key "${key}"`);
    }
    return region;
  }

  getUVTransform(key: string): UVTransform {
    const region = this.getRegion(key);
    return {
      offset: region.uvOffset,
      scale: region.uvScale,
    };
  }

  listRegions(): TextureAtlasRegion[] {
    return Array.from(this.regions.values());
  }
}
