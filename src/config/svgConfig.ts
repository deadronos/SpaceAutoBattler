// SVG Configuration
// Centralized settings for SVG loading, caching, and rendering

export interface SVGConfig {
  // File paths and loading
  svgDir: string;
  defaultFileNames: string[];

  // Rasterization settings
  defaultRasterSize: {
    width: number;
    height: number;
  };

  // Caching settings
  cache: {
    maxEntries: number;
    maxAgeMs: number;
    enableFileWatching: boolean;
    watchPollIntervalMs: number;
  };

  // Team colors for tinting
  teamColors: {
    red: string;
    blue: string;
  };

  // Performance settings
  worker: {
    enableOffscreenCanvas: boolean;
    rasterTimeoutMs: number;
  };
}

export const defaultSVGConfig: SVGConfig = {
  // File paths and loading
  svgDir: './dist/svg/',
  defaultFileNames: ['fighter.svg', 'corvette.svg', 'frigate.svg', 'destroyer.svg', 'carrier.svg'],

  // Rasterization settings
  defaultRasterSize: {
    width: 128,
    height: 128
  },

  // Caching settings
  cache: {
    maxEntries: 50,
    maxAgeMs: 300000, // 5 minutes
    enableFileWatching: true,
    watchPollIntervalMs: 2000 // Check every 2 seconds
  },

  // Team colors for tinting
  teamColors: {
    red: '#ff5050',
    blue: '#50a0ff'
  },

  // Performance settings
  worker: {
    enableOffscreenCanvas: true,
    rasterTimeoutMs: 10000
  }
};

// Get SVG URLs for all default ship types
export function getShipSVGUrls(config: SVGConfig = defaultSVGConfig): string[] {
  return config.defaultFileNames.map(fileName => `${config.svgDir}${fileName}`);
}

// Get SVG URL for specific ship class
export function getShipSVGUrl(shipClass: string, config: SVGConfig = defaultSVGConfig): string {
  return `${config.svgDir}${shipClass}.svg`;
}

// Check if OffscreenCanvas is supported
export function isOffscreenCanvasSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined' &&
         typeof OffscreenCanvas.prototype.getContext === 'function';
}

// Get team color for tinting
export function getTeamColor(team: 'red' | 'blue', config: SVGConfig = defaultSVGConfig): string {
  return config.teamColors[team];
}