// Renderer effects and visual configuration
export interface RendererEffectsConfig {
  skybox: {
    starfield: {
      textureSize: number;
      starCounts: {
        top: number;
        bottom: number;
        sides: number;
      };
      nebula: {
        count: number;
        minRadius: number;
        maxRadius: number;
      };
      animation: {
        twinkleSpeed: number;
        updateFrequency: number;
      };
    };
    sphere: {
      radius: number;
      geometrySegments: number;
    };
  };
  lighting: {
    ambient: {
      color: string;
      intensity: number;
    };
    directional: {
      color: string;
      intensity: number;
      position: {
        x: number;
        y: number;
        z: number;
      };
    };
  };
  worldBoundaries: {
    color: string;
    opacity: number;
  };
}

export const DefaultRendererEffectsConfig: RendererEffectsConfig = {
  skybox: {
    starfield: {
      textureSize: 512,
      starCounts: {
        top: 800,
        bottom: 300,
        sides: 1200,
      },
      nebula: {
        count: 3,
        minRadius: 50,
        maxRadius: 100,
      },
      animation: {
        twinkleSpeed: 2.0,
        updateFrequency: 3,
      },
    },
    sphere: {
      radius: 5000,
      geometrySegments: 32,
    },
  },
  lighting: {
    ambient: {
      color: '#404040',
      intensity: 0.6,
    },
    directional: {
      color: '#ffffff',
      intensity: 0.8,
      position: {
        x: 1000,
        y: 1000,
        z: 1000,
      },
    },
  },
  worldBoundaries: {
    color: '#4a90e2',
    opacity: 0.6,
  },
};

// Export the default config as RendererEffectsConfig for backward compatibility
export const RendererEffectsConfig = DefaultRendererEffectsConfig;