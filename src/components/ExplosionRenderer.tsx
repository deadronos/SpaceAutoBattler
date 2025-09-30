import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Quaternion, Vector3, Color } from 'three';
import { useBloomRegistration } from '../renderer/BloomProvider.js';
import { useGameState } from '../game/context.js';
import {
  DEBRIS_CAPACITY,
  DEBRIS_DELAY,
  FIREBALL_CAPACITY,
  FLASH_CAPACITY,
  FLASH_DURATION,
  PLASMA_CAPACITY,
  PLASMA_DELAY,
  SHOCKWAVE_CAPACITY,
  SMOKE_CAPACITY,
  SMOKE_DELAY,
  SPARKS_CAPACITY,
  SPARKS_DELAY,
} from './explosions/constants.js';
import { clamp01, easeOutQuad, getCachedColor, getDerived } from './explosions/derived.js';
import { useExplosionResources } from './explosions/materials.js';
import { DynamicLightManager } from './explosions/DynamicLightManager.js';

export function ExplosionRenderer(): React.ReactElement {
  const state = useGameState();
  const flashRef = useRef<InstancedMesh>(null);
  const shockwaveRef = useRef<InstancedMesh>(null);
  const fireballRef = useRef<InstancedMesh>(null);
  const debrisRef = useRef<InstancedMesh>(null);
  const sparksRef = useRef<InstancedMesh>(null);
  const plasmaRef = useRef<InstancedMesh>(null);
  const smokeRef = useRef<InstancedMesh>(null);

  useBloomRegistration(flashRef, { group: 'explosions' });
  useBloomRegistration(shockwaveRef, { group: 'explosions' });
  useBloomRegistration(fireballRef, { group: 'explosions' });

  const { geometries, materials } = useExplosionResources();

  const dummy = useMemo(() => new Object3D(), []);
  const tmpQuat = useMemo(() => new Quaternion(), []);
  const tmpVec = useMemo(() => new Vector3(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(({ camera }) => {
    const events = state.explosions;
    const flashMesh = flashRef.current;
    const shockwaveMesh = shockwaveRef.current;
    const fireballMesh = fireballRef.current;
    const debrisMesh = debrisRef.current;
    const sparksMesh = sparksRef.current;
    const plasmaMesh = plasmaRef.current;
    const smokeMesh = smokeRef.current;
    if (
      !flashMesh ||
      !shockwaveMesh ||
      !fireballMesh ||
      !debrisMesh ||
      !sparksMesh ||
      !plasmaMesh ||
      !smokeMesh
    ) {
      return;
    }

    let flashIndex = 0;
    let shockwaveIndex = 0;
    let fireballIndex = 0;
    let debrisIndex = 0;
    let sparksIndex = 0;
    let plasmaIndex = 0;
    let smokeIndex = 0;

    for (const event of events) {
      const basePosition = event.position;
      const time = event.elapsed;
      const derived = getDerived(event);

      if (time <= FLASH_DURATION) {
        const flashT = clamp01(time / FLASH_DURATION);
        const intensity = (1 - flashT) * event.flashIntensity * derived.flicker;
        const scale = event.radius * (0.6 + 0.5 * easeOutQuad(1 - flashT));
        dummy.position.copy(basePosition);
        dummy.scale.setScalar(scale);
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        flashMesh.setMatrixAt(flashIndex, dummy.matrix);
        color.copy(getCachedColor(event.palette.flash)).multiplyScalar(Math.max(0.3, intensity));
        flashMesh.setColorAt(flashIndex, color);
        flashIndex += 1;
      }

      const shockwaveT = time - event.shockwave.delay;
      if (shockwaveT >= 0 && shockwaveT <= event.shockwave.duration) {
        const phase = clamp01(shockwaveT / event.shockwave.duration);
        const radius = event.shockwave.maxRadius * easeOutQuad(phase);
        dummy.position.copy(basePosition);
        dummy.scale.set(radius, radius, radius);
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        shockwaveMesh.setMatrixAt(shockwaveIndex, dummy.matrix);
        color
          .copy(getCachedColor(event.palette.shockwave))
          .multiplyScalar(Math.max(0.2, 1 - phase * 0.9));
        shockwaveMesh.setColorAt(shockwaveIndex, color);
        shockwaveIndex += 1;
      }

      const fireballT = time - event.fireball.delay;
      if (fireballT >= 0 && fireballT <= event.fireball.duration) {
        const firePhase = clamp01(fireballT / event.fireball.duration);
        const scale = event.radius * (0.4 + 0.8 * (1 - firePhase));
        dummy.position.copy(basePosition);
        dummy.scale.setScalar(scale);
        dummy.quaternion.identity();
        dummy.updateMatrix();
        fireballMesh.setMatrixAt(fireballIndex, dummy.matrix);
        const hotColor = getCachedColor(event.palette.fireballHot);
        const coolColor = getCachedColor(event.palette.smoke);
        color.copy(hotColor).lerp(coolColor, firePhase * 0.65);
        fireballMesh.setColorAt(fireballIndex, color);
        fireballIndex += 1;
      }

      const debrisT = time - DEBRIS_DELAY;
      if (debrisT >= 0) {
        for (const shard of derived.debris) {
          if (debrisT > shard.lifetime || debrisIndex >= DEBRIS_CAPACITY) continue;
          const shardProgress = clamp01(debrisT / shard.lifetime);
          const distance = shard.speed * debrisT;
          tmpVec.copy(shard.direction).multiplyScalar(distance).add(basePosition);
          dummy.position.copy(tmpVec);
          const shardScale = Math.max(event.radius * 0.05 * shard.scale * (1 - shardProgress), 0.04);
          dummy.scale.setScalar(shardScale);
          tmpQuat.setFromAxisAngle(shard.axis, shard.spin * debrisT);
          dummy.quaternion.copy(tmpQuat);
          dummy.updateMatrix();
          debrisMesh.setMatrixAt(debrisIndex, dummy.matrix);
          color
            .copy(getCachedColor(event.palette.fireballHot))
            .multiplyScalar(Math.max(0.2, 1 - shardProgress * 0.8));
          debrisMesh.setColorAt(debrisIndex, color);
          debrisIndex += 1;
        }
      }

      const sparksT = time - SPARKS_DELAY;
      if (sparksT >= 0) {
        for (const spark of derived.sparks) {
          if (sparksT > spark.lifetime || sparksIndex >= SPARKS_CAPACITY) continue;
          const sparkProgress = clamp01(sparksT / spark.lifetime);
          const distance = spark.speed * sparksT;
          tmpVec.copy(spark.direction).multiplyScalar(distance).add(basePosition);
          dummy.position.copy(tmpVec);
          const scale = Math.max(event.radius * 0.035 * spark.scale * (1 - sparkProgress), 0.01);
          dummy.scale.setScalar(scale);
          dummy.quaternion.copy(camera.quaternion);
          dummy.updateMatrix();
          sparksMesh.setMatrixAt(sparksIndex, dummy.matrix);
          color
            .copy(getCachedColor(event.palette.flash))
            .multiplyScalar(Math.max(0.25, 1 - sparkProgress * 0.9));
          sparksMesh.setColorAt(sparksIndex, color);
          sparksIndex += 1;
        }
      }

      const plasmaT = time - PLASMA_DELAY;
      if (plasmaT >= 0) {
        for (const plume of derived.plasma) {
          if (plasmaT > plume.lifetime || plasmaIndex >= PLASMA_CAPACITY) continue;
          const plumeProgress = clamp01(plasmaT / plume.lifetime);
          const distance = plume.speed * plasmaT;
          tmpVec.copy(plume.direction).multiplyScalar(distance).add(basePosition);
          dummy.position.copy(tmpVec);
          const scale = event.radius * 0.45 * plume.scale * (1 - plumeProgress * 0.7);
          dummy.scale.set(scale, scale * 0.9, scale);
          tmpQuat.setFromAxisAngle(plume.axis, plume.spin * plasmaT);
          dummy.quaternion.copy(tmpQuat);
          dummy.updateMatrix();
          plasmaMesh.setMatrixAt(plasmaIndex, dummy.matrix);
          color
            .copy(getCachedColor(event.palette.shockwave))
            .multiplyScalar(Math.max(0.15, 1 - plumeProgress));
          plasmaMesh.setColorAt(plasmaIndex, color);
          plasmaIndex += 1;
        }
      }

      const smokeT = time - SMOKE_DELAY;
      if (smokeT >= 0) {
        for (const wisp of derived.smoke) {
          if (smokeT > wisp.lifetime || smokeIndex >= SMOKE_CAPACITY) continue;
          const wispProgress = clamp01(smokeT / wisp.lifetime);
          tmpVec
            .copy(wisp.offset)
            .add(basePosition)
            .addScaledVector(wisp.drift, smokeT);
          dummy.position.copy(tmpVec);
          const scale = event.radius * 0.6 * wisp.scale * (1 - wispProgress * 0.4);
          dummy.scale.setScalar(scale);
          dummy.quaternion.copy(camera.quaternion);
          dummy.updateMatrix();
          smokeMesh.setMatrixAt(smokeIndex, dummy.matrix);
          color
            .copy(getCachedColor(event.palette.smoke))
            .multiplyScalar(Math.max(0.2, 0.7 - wispProgress * 0.5));
          smokeMesh.setColorAt(smokeIndex, color);
          smokeIndex += 1;
        }
      }
    }

    flashMesh.count = flashIndex;
    shockwaveMesh.count = shockwaveIndex;
    fireballMesh.count = fireballIndex;
    debrisMesh.count = debrisIndex;
    sparksMesh.count = sparksIndex;
    plasmaMesh.count = plasmaIndex;
    smokeMesh.count = smokeIndex;

    flashMesh.instanceMatrix.needsUpdate = true;
    shockwaveMesh.instanceMatrix.needsUpdate = true;
    fireballMesh.instanceMatrix.needsUpdate = true;
    debrisMesh.instanceMatrix.needsUpdate = true;
    sparksMesh.instanceMatrix.needsUpdate = true;
    plasmaMesh.instanceMatrix.needsUpdate = true;
    smokeMesh.instanceMatrix.needsUpdate = true;

    if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
    if (shockwaveMesh.instanceColor) shockwaveMesh.instanceColor.needsUpdate = true;
    if (fireballMesh.instanceColor) fireballMesh.instanceColor.needsUpdate = true;
    if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
    if (sparksMesh.instanceColor) sparksMesh.instanceColor.needsUpdate = true;
    if (plasmaMesh.instanceColor) plasmaMesh.instanceColor.needsUpdate = true;
    if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;

    flashMesh.visible = flashIndex > 0;
    shockwaveMesh.visible = shockwaveIndex > 0;
    fireballMesh.visible = fireballIndex > 0;
    debrisMesh.visible = debrisIndex > 0;
    sparksMesh.visible = sparksIndex > 0;
    plasmaMesh.visible = plasmaIndex > 0;
    smokeMesh.visible = smokeIndex > 0;
  });

  return (
    <group>
      <instancedMesh
        ref={flashRef}
        args={[geometries.flash, materials.flash, FLASH_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={shockwaveRef}
        args={[geometries.shockwave, materials.shockwave, SHOCKWAVE_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={fireballRef}
        args={[geometries.fireball, materials.fireball, FIREBALL_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={debrisRef}
        args={[geometries.debris, materials.debris, DEBRIS_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparksRef}
        args={[geometries.sparks, materials.sparks, SPARKS_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={plasmaRef}
        args={[geometries.plasma, materials.plasma, PLASMA_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={smokeRef}
        args={[geometries.smoke, materials.smoke, SMOKE_CAPACITY]}
        frustumCulled={false}
      />
    </group>
  );
}

export function ExplosionsLayer(): React.ReactElement {
  return (
    <group>
      <ExplosionRenderer />
      <DynamicLightManager />
    </group>
  );
}

