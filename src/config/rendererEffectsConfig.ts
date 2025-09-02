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
        twinkleAmplitude: number;
        twinklePhaseOffset: number;
        minAlpha: number;
      };
      baseSeed: number;
      colors: {
        background: {
          center: string;
          middle: string;
          edge: string;
        };
        stars: string[];
      };
      starSizes: {
        smallProbability: number;
        mediumProbability: number;
        // large stars are 1 - smallProbability - mediumProbability
      };
      brightness: {
        min: number;
        range: number; // actual brightness = min + random() * range
      };
      facePatterns: {
        topDensityFactor: number;
        bottomDensityFactor: number;
        sideDensityFactor: number;
        milkyWayEffect: number; // for top face center band
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
      textureSize: 1920,
      baseSeed: 12345,
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
        twinkleAmplitude: 0.3,
        twinklePhaseOffset: 0.001,
        minAlpha: 0.15,
      },
      colors: {
        background: {
          center: '#000011',
          middle: '#000033',
          edge: '#000000',
        },
        stars: ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'],
      },
      starSizes: {
        smallProbability: 0.7,
        mediumProbability: 0.2, // 0.9 - 0.7 = 0.2
      },
      brightness: {
        min: 0.3,
        range: 0.7,
      },
      facePatterns: {
        topDensityFactor: 0.7, // Milky Way effect intensity
        bottomDensityFactor: 0.3, // Sparse bottom
        sideDensityFactor: 0.8, // Dense sides
        milkyWayEffect: 0.7, // Center band effect for top face
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