export type KinematicBody = {
  setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void;
  setNextKinematicRotation?: (r: { x: number; y: number; z: number; w: number }) => void;
  setLinvel?: (v: { x: number; y: number; z: number }) => void;
  setAngvel?: (v: { x: number; y: number; z: number }) => void;
  setMass?: (m: number) => void;
  setLinearDamping?: (d: number) => void;
  setAngularDamping?: (d: number) => void;
};

export type Collider = {
  setFriction?: (f: number) => void;
  setRestitution?: (r: number) => void;
};
