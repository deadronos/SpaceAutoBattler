import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { useGameState } from '../../game/context.js';
import {
  DEBRIS_CAPACITY,
  FIREBALL_CAPACITY,
  FLASH_CAPACITY,
  PLASMA_CAPACITY,
  SHOCKWAVE_CAPACITY,
  SMOKE_CAPACITY,
  SPARKS_CAPACITY,
} from './constants.js';
import { getDerived } from './derived.js';
import { useExplosionResources } from './materials.js';
import { DynamicLightManager } from './DynamicLightManager.js';
import {
  finalizeInstancedMeshes,
  type EffectCounts,
  type InstancedMeshRefs,
} from './instancedManager.js';
import {
  updateDebris,
  updateFireball,
  updateFlash,
  updatePlasma,
  updateShockwave,
  updateSmoke,
  updateSparks,
  type EffectUpdateContext,
} from './effectUpdaters/index.js';

export function ExplosionRendererCore(): React.ReactElement {
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
    const refs: InstancedMeshRefs = {
      flash: flashRef.current,
      shockwave: shockwaveRef.current,
      fireball: fireballRef.current,
      debris: debrisRef.current,
      sparks: sparksRef.current,
      plasma: plasmaRef.current,
      smoke: smokeRef.current,
    };

    if (
      !refs.flash ||
      !refs.shockwave ||
      !refs.fireball ||
      !refs.debris ||
      !refs.sparks ||
      !refs.plasma ||
      !refs.smoke
    ) {
      return;
    }

    const counts: EffectCounts = {
      flash: 0,
      shockwave: 0,
      fireball: 0,
      debris: 0,
      sparks: 0,
      plasma: 0,
      smoke: 0,
    };

    for (const event of state.explosions) {
      const time = event.elapsed;
      const derived = getDerived(event);

      const ctx: EffectUpdateContext = {
        event,
        time,
        camera,
        derived,
        dummy,
        tmpQuat,
        tmpVec,
        color,
      };

      counts.flash += updateFlash(ctx, refs.flash, counts.flash, FLASH_CAPACITY);
      counts.shockwave += updateShockwave(ctx, refs.shockwave, counts.shockwave, SHOCKWAVE_CAPACITY);
      counts.fireball += updateFireball(ctx, refs.fireball, counts.fireball, FIREBALL_CAPACITY);
      counts.debris += updateDebris(ctx, refs.debris, counts.debris, DEBRIS_CAPACITY);
      counts.sparks += updateSparks(ctx, refs.sparks, counts.sparks, SPARKS_CAPACITY);
      counts.plasma += updatePlasma(ctx, refs.plasma, counts.plasma, PLASMA_CAPACITY);
      counts.smoke += updateSmoke(ctx, refs.smoke, counts.smoke, SMOKE_CAPACITY);
    }

    finalizeInstancedMeshes(refs, counts);
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
      <ExplosionRendererCore />
      <DynamicLightManager />
    </group>
  );
}
