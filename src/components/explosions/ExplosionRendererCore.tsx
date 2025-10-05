import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { useGameState } from '../../game/context.js';
import { createSaturationWarningState, warnOnSaturation } from '../layers/saturationWarning.js';
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
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);

  useFrame(({ camera }) => {
    frameRef.current += 1;
    const frameId = frameRef.current;
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

    const saturationState: Record<keyof EffectCounts, boolean> = {
      flash: false,
      shockwave: false,
      fireball: false,
      debris: false,
      sparks: false,
      plasma: false,
      smoke: false,
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

      const flashResult = updateFlash(ctx, refs.flash, counts.flash, FLASH_CAPACITY);
      counts.flash += flashResult.count;
      saturationState.flash ||= flashResult.saturated;

      const shockwaveResult = updateShockwave(ctx, refs.shockwave, counts.shockwave, SHOCKWAVE_CAPACITY);
      counts.shockwave += shockwaveResult.count;
      saturationState.shockwave ||= shockwaveResult.saturated;

      const fireballResult = updateFireball(ctx, refs.fireball, counts.fireball, FIREBALL_CAPACITY);
      counts.fireball += fireballResult.count;
      saturationState.fireball ||= fireballResult.saturated;

      const debrisResult = updateDebris(ctx, refs.debris, counts.debris, DEBRIS_CAPACITY);
      counts.debris += debrisResult.count;
      saturationState.debris ||= debrisResult.saturated;

      const sparksResult = updateSparks(ctx, refs.sparks, counts.sparks, SPARKS_CAPACITY);
      counts.sparks += sparksResult.count;
      saturationState.sparks ||= sparksResult.saturated;

      const plasmaResult = updatePlasma(ctx, refs.plasma, counts.plasma, PLASMA_CAPACITY);
      counts.plasma += plasmaResult.count;
      saturationState.plasma ||= plasmaResult.saturated;

      const smokeResult = updateSmoke(ctx, refs.smoke, counts.smoke, SMOKE_CAPACITY);
      counts.smoke += smokeResult.count;
      saturationState.smoke ||= smokeResult.saturated;
    }

    finalizeInstancedMeshes(refs, counts);

    const saturated = Object.values(saturationState).some(Boolean);
    warnOnSaturation({
      saturated,
      frameId,
      state: warningStateRef.current,
      message: '[ExplosionRendererCore] Capacity saturated, clamping explosion visuals.',
    });
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
