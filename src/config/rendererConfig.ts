// Renderer configuration for visual effects and display settings
export interface RendererConfig {
  // Camera settings
  camera: {
    fov: number;
    near: number;
    far: number;
    cameraZ: number;
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
      count: number;
      lifetime: number;
      speed: number;
      colors: string[];
      size: number;
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
}

export const DefaultRendererConfig: RendererConfig = {
  camera: {
    fov: 55,
    near: 0.1,
    far: 10000,
    cameraZ: 900,
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
      count: 15,
      lifetime: 1.2,
      speed: 150,
      colors: ['#ffaa00', '#ff6600', '#ff3300', '#ffff88'],
      size: 4,
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
};

// Export the default config as RendererConfig for backward compatibility
export const RendererConfig = DefaultRendererConfig;
