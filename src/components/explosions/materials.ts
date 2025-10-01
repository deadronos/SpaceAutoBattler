import { useMemo, useEffect } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TetrahedronGeometry,
} from 'three';

export interface ExplosionGeometries {
  flash: SphereGeometry;
  shockwave: RingGeometry;
  fireball: SphereGeometry;
  debris: TetrahedronGeometry;
  sparks: SphereGeometry;
  plasma: PlaneGeometry;
  smoke: PlaneGeometry;
}

export interface ExplosionMaterials {
  flash: MeshBasicMaterial;
  shockwave: MeshBasicMaterial;
  fireball: MeshStandardMaterial;
  debris: MeshStandardMaterial;
  sparks: MeshBasicMaterial;
  plasma: MeshBasicMaterial;
  smoke: MeshBasicMaterial;
}

export interface ExplosionResources {
  geometries: ExplosionGeometries;
  materials: ExplosionMaterials;
}

export function useExplosionResources(): ExplosionResources {
  const geometries = useMemo(
    () => ({
      flash: new SphereGeometry(1, 16, 16),
      shockwave: new RingGeometry(0.5, 0.7, 32),
      fireball: new SphereGeometry(1, 20, 16),
      debris: new TetrahedronGeometry(0.4, 0),
      sparks: new SphereGeometry(0.2, 8, 6),
      plasma: new PlaneGeometry(1, 1),
      smoke: new PlaneGeometry(1, 1),
    }),
    []
  );

  const materials = useMemo(() => {
    const flash = new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    flash.toneMapped = false;

    const shockwave = new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    shockwave.toneMapped = false;

    const fireball = new MeshStandardMaterial({
      color: new Color('#ff8844'),
      emissive: new Color('#ff5500'),
      emissiveIntensity: 2.2,
      roughness: 0.6,
      metalness: 0,
    });
    fireball.toneMapped = true;

    const debris = new MeshStandardMaterial({
      color: new Color('#ffaa66'),
      emissive: new Color('#ff9966'),
      emissiveIntensity: 1.6,
      roughness: 0.8,
      metalness: 0.1,
    });
    debris.toneMapped = true;

    const sparks = new MeshBasicMaterial({
      color: new Color('#ffcc88'),
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    sparks.toneMapped = false;

    const plasma = new MeshBasicMaterial({
      color: new Color('#ff9955'),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    plasma.toneMapped = false;

    const smoke = new MeshBasicMaterial({
      color: new Color('#555555'),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: DoubleSide,
    });
    smoke.toneMapped = true;

    return { flash, shockwave, fireball, debris, sparks, plasma, smoke };
  }, []);

  useEffect(
    () => () => {
      geometries.flash.dispose();
      geometries.shockwave.dispose();
      geometries.fireball.dispose();
      geometries.debris.dispose();
      geometries.sparks.dispose();
      geometries.plasma.dispose();
      geometries.smoke.dispose();

      materials.flash.dispose();
      materials.shockwave.dispose();
      materials.fireball.dispose();
      materials.debris.dispose();
      materials.sparks.dispose();
      materials.plasma.dispose();
      materials.smoke.dispose();
    },
    [geometries, materials]
  );

  return { geometries, materials };
}
