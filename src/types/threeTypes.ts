export type Vec3 = { x: number; y: number; z: number };

export interface ComponentPosition {
  x: number;  // Relative to ship center (-1 to 1)
  y: number;  // Relative to ship center (-1 to 1) 
  z: number;  // Relative to ship center (-1 to 1)
}

export interface Ship3D {
  id: string;
  type: string;
  team?: string;
  position: Vec3;
  velocity: Vec3;
  acceleration?: Vec3;
  rotation?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  scale?: number;
  assetKey?: string;
  collisionRadius?: number;
  
  // Component positions (relative to ship center, in ship-local coordinates)
  turrets?: ComponentPosition[];
  engines?: ComponentPosition[];
  hardpoints?: ComponentPosition[]; // Generic attachment points
  
  // Ship configuration
  shipScale?: number;     // Individual ship scale multiplier
  baseScale?: number;     // Base archetype scale
}

export interface GameState3D {
  ships: Ship3D[];
  flashes?: any[];
  t?: number;
  camera?: {
    position: Vec3;
    target?: Vec3;
    fov?: number;
    near?: number;
    far?: number;
  };
  bounds?: {
    width: number;
    height: number;
    depth: number;
    wrap: { x: boolean; y: boolean; z: boolean };
  };
  // allow arbitrary other fields from legacy GameState
  [k: string]: any;
}

export default GameState3D;
