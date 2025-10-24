import { AdditiveBlending, Color, MeshBasicMaterial, MeshBasicMaterialParameters } from 'three';

export function createThrusterGlowMaterial(
  parameters: MeshBasicMaterialParameters = {},
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: new Color('#5fb6ff'),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexColors: true,
    ...parameters,
  });
  material.name = 'thruster-glow-instance';
  return material;
}

export function createShipImpostorMaterial(
  parameters: MeshBasicMaterialParameters = {},
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: new Color('#8fa2ff'),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    ...parameters,
  });
  material.name = 'ship-impostor-instance';
  return material;
}
