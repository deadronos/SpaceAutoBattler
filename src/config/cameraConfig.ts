// Camera configuration for controls, movement, and cinematic behavior
export interface CameraConfig {
  controls: {
    mouseSensitivity: number;
    zoomSpeed: number;
    moveSpeed: number;
  };
  cinematic: {
    lerpFactor: number; // How quickly camera follows targets
    distanceLerpFactor: number; // How quickly camera distance adjusts
    fleetDistanceMultiplier: number; // Multiplier for optimal distance calculation
    minDistance: number; // Minimum camera distance
    maxDistance: number; // Maximum camera distance
    fovMultiplier: number; // FOV multiplier for distance calculation
  };
  resetToCinematic: {
    fovMultiplier: number; // FOV multiplier for cinematic reset
    optimalDistanceMultiplier: number; // Distance multiplier for cinematic reset
    cameraRotation: {
      x: number; // Pitch (downward tilt)
      y: number; // Yaw (horizontal rotation)
      z: number; // Roll
    };
  };
}

export const DefaultCameraConfig: CameraConfig = {
  controls: {
    mouseSensitivity: 0.005,
    zoomSpeed: 50,
    moveSpeed: 300,
  },
  cinematic: {
    lerpFactor: 2.0, // Smooth following with 2 seconds lerp time
    distanceLerpFactor: 1.0, // Slower distance adjustment
    fleetDistanceMultiplier: 1.5,
    minDistance: 300,
    maxDistance: 3000,
    fovMultiplier: 1.5,
  },
  resetToCinematic: {
    fovMultiplier: 1.5,
    optimalDistanceMultiplier: 1.5,
    cameraRotation: {
      x: -Math.PI / 6, // Slight downward tilt
      y: 0, // Face the action
      z: 0,
    },
  },
};

// Export the default config as CameraConfig for backward compatibility
export const CameraConfig = DefaultCameraConfig;