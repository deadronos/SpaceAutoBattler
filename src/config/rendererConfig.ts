// Renderer configuration for visual effects and display settings
export interface RendererConfig {
  // Camera settings
  camera: {
    fov: number;
    near: number;
    far: number;
    cameraZ: number;
    // Optional camera distance limits (min/max world units)
    minDistance?: number;
    maxDistance?: number;
    rotation: {
      pitch: number;
      yaw: number;
      roll: number;
    };
  };

  // General visual settings
  visual: {
    enableTrails: boolean;
    enableParticles: boolean;
    enableShieldEffects: boolean;
    enableHealthBars: boolean;
  };

  // Shield effect settings
  shield: {
    colors: {
      red: string; // hex color for red team shields
      blue: string; // hex color for blue team shields
    };
    opacity: {
      base: number; // base opacity when shield is full
      min: number; // minimum opacity when shield is low
    };
    animation: {
      pulseSpeed: number; // pulse animation speed
      rippleSpeed: number; // ripple effect speed
      scaleMultiplier: number; // how much larger than ship
    };
    // Hex grid visual parameters
    hexGrid: {
      density: number; // number of hexes around equator
      edgeWidth: number; // grid line width
      splashRadius: number; // axial radius for multi-hex splash (e.g., 1 = neighbors)
      hitWindow: number; // seconds to keep a hex lit after hit
      hitMax: number; // max concurrent recent hits to track
    };
    // Ripple/crack effect parameters
    ripple: {
      amplitude: number; // strength of ripple brightness
      speed: number; // angular wave speed
      falloff: number; // spatial falloff factor across hex radius
    };
    // Directional arc highlight parameters
    arc: {
      alignStart: number; // smoothstep start threshold for arc alignment
      alignEnd: number; // smoothstep end threshold for arc alignment
      alphaScale: number; // multiplier for arc alpha contribution
      colorScale: number; // multiplier for arc color contribution
    };
    // Damage scaling parameters
    damage: {
      normalizeBy: number; // divisor to map raw damage -> ~[0..1]
      minScale: number; // minimum scale applied for very low damage
      maxScale: number; // clamp for high damage
    };
  };

  // Particle system settings
  particles: {
    hitEffect: {
      count: number; // number of particles per hit
      lifetime: number; // seconds
      speed: number; // initial speed
      colors: {
        red: string;
        blue: string;
      };
      size: number;
    };
    explosion: {
      enabled: boolean; // feature flag to enable particle explosions
      // density-based count: particles = clamp(countPerRadius * radius, minCount, maxCount)
      countPerRadius: number;
      minCount: number;
      maxCount: number;
      lifetime: number; // seconds
      // size range in world units or normalized units depending on renderer
      size: {
        min: number;
        max: number;
      };
      // initial velocity parameters
      velocity: {
        radial: {
          min: number;
          max: number;
        };
        randomSpread: number; // 0..1 spread multiplier
      };
      colors: string[];
      // pooling controls for instance buffer and particle pool
      pooling: {
        initial: number; // initial pool size
        growTo: number; // max pool size under stress
      };
      // LOD fallback sizes or thresholds can be added later
    };
  };

  // Engine trail settings
  trails: {
    colors: {
      red: string;
      blue: string;
    };
    length: number; // trail length in world units
    fadeSpeed: number; // how quickly trail fades
    width: number; // trail width
    opacity: {
      start: number; // opacity at trail start
      end: number; // opacity at trail end
    };
  };

  // Health/shield bar settings
  healthBars: {
    position: {
      offsetX: number; // offset from ship center
      offsetY: number;
      height: number; // bar height
    };
    // Small camera-facing Z offset applied to billboards to avoid z-fighting
    zOffset?: number;
    colors: {
      health: {
        full: string;
        damaged: string;
        critical: string;
      };
      shield: {
        full: string;
        damaged: string;
      };
      background: string;
    };
    width: number; // bar width
    border: {
      color: string;
      width: number;
    };
  };

  instancingDebug?: boolean;

  // Whether to eagerly load GLTF models (set to false for lightweight deployments)
  loadGltfModels?: boolean;

  // Instancing settings for performance optimization
  instancing: {
    enableBullets: boolean; // feature flag for bullet instancing
    enableBars: boolean; // feature flag for health/shield bar instancing
    enableShips?: boolean; // optional feature flag for ship instancing
    bullets: {
      initialCapacity: number; // starting number of bullet instances
      maxCapacity: number; // maximum number of bullet instances
      growthFactor: number; // how much to grow capacity when needed
      warnThreshold: number; // warn when usage exceeds this percentage
    };
    bars: {
      initialCapacity: number; // starting number of health bar instances
      maxCapacity: number; // maximum number of health bar instances
      growthFactor: number; // how much to grow capacity when needed
      warnThreshold: number; // warn when usage exceeds this percentage
    };
    ships?: {
      initialCapacity: number; // starting number of ship instances per group
      maxCapacity: number; // maximum number of ship instances per group
      growthFactor: number; // how much to grow capacity when needed
      warnThreshold: number; // warn when usage exceeds this percentage
    };
  };

  // Default values for entities
  defaultCollisionRadius: number;
  defaultScale: number;

  // Performance monitoring settings
  performance: {
    enableProfiling: boolean; // enable hotpath profiling
    showOverlay: boolean; // show performance overlay on screen
    overlayUpdateMs: number; // how often to update overlay (ms)
  };
}

export const DefaultRendererConfig: RendererConfig = {
  camera: {
    fov: 55,
    near: 0.1,
    far: 10000,
    cameraZ: 900,
    minDistance: 100,
    maxDistance: 5000,
    rotation: {
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
  },

  visual: {
    enableTrails: true,
    enableParticles: true,
    enableShieldEffects: true,
    enableHealthBars: true,
  },

  shield: {
    colors: {
      red: '#ff4444',
      blue: '#4444ff',
    },
    opacity: {
      base: 0.3,
      min: 0.1,
    },
    animation: {
      pulseSpeed: 2.0,
      rippleSpeed: 1.5,
      scaleMultiplier: 1.2,
    },
    hexGrid: {
      density: 30,
      edgeWidth: 0.015,
      splashRadius: 1.0,
      hitWindow: 0.6,
      hitMax: 8,
    },
    ripple: {
      amplitude: 0.45,
      speed: 1.6,
      falloff: 1.8,
    },
    arc: {
      alignStart: 0.75,
      alignEnd: 0.98,
      alphaScale: 0.6,
      colorScale: 1.0,
    },
    damage: {
      normalizeBy: 30.0,
      minScale: 0.3,
      maxScale: 1.5,
    },
  },

  particles: {
    hitEffect: {
      count: 8,
      lifetime: 0.8,
      speed: 100,
      colors: {
        red: '#ff6666',
        blue: '#6666ff',
      },
      size: 3,
    },
    explosion: {
      enabled: true,
      countPerRadius: 18, // base particles per world-unit radius
      minCount: 8,
      maxCount: 200,
      lifetime: 1.2,
      size: {
        min: 0.02,
        max: 0.25,
      },
      velocity: {
        radial: { min: 40, max: 240 },
        randomSpread: 0.6,
      },
      colors: ['#fffbda', '#ff8c00', '#440000'],
      pooling: { initial: 256, growTo: 2048 },
    },
  },

  trails: {
    colors: {
      red: '#ff6666',
      blue: '#6666ff',
    },
    length: 25,
    fadeSpeed: 3.0,
    width: 2,
    opacity: {
      start: 0.8,
      end: 0.1,
    },
  },

  healthBars: {
    position: {
      offsetX: 0,
      offsetY: -25,
      height: 4,
    },
    zOffset: 0.002,
    colors: {
      health: {
        full: '#00ff00',
        damaged: '#ffff00',
        critical: '#ff0000',
      },
      shield: {
        full: '#0088ff',
        damaged: '#ff8800',
      },
      background: '#333333',
    },
    width: 30,
    border: {
      color: '#ffffff',
      width: 1,
    },
  },

  instancingDebug: true,

  instancing: {
    enableBullets: true, // default true for feature branch testing
    enableBars: true, // default false until implementation is complete
    enableShips: true, // default false until ship instancing is ready
    bullets: {
      initialCapacity: 800, // start with capacity for 800 bullets (raised to reduce instancer growth/warnings)
      maxCapacity: 2000, // max 2000 bullets before warning
      growthFactor: 1.5, // grow capacity by 50% when needed
      warnThreshold: 0.8, // warn when 80% capacity is reached
    },
    bars: {
      initialCapacity: 200, // start with capacity for 200 health bars
      maxCapacity: 1000, // max 1000 health bars before warning
      growthFactor: 1.5, // grow capacity by 50% when needed
      warnThreshold: 0.8, // warn when 80% capacity is reached
    },
    ships: {
      initialCapacity: 50,
      maxCapacity: 500,
      growthFactor: 1.5,
      warnThreshold: 0.8
    }
  },

  defaultCollisionRadius: 1.0,
  defaultScale: 1.0,
  loadGltfModels: false,

  performance: {
    enableProfiling: false, // disabled by default, enable via query param or explicit config
    showOverlay: false, // disabled by default
    overlayUpdateMs: 250, // update overlay 4 times per second
  },
};

// Export the default config as RendererConfig for backward compatibility
export const RendererConfig = DefaultRendererConfig;
