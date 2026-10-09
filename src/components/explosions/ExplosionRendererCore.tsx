import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
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
import { ExplosionsInstancedManager, type InstancedMeshRefs } from './instancedManager.js';
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
  const managerRef = useRef(
    new ExplosionsInstancedManager({
      flash: FLASH_CAPACITY,
      shockwave: SHOCKWAVE_CAPACITY,
      fireball: FIREBALL_CAPACITY,
      debris: DEBRIS_CAPACITY,
      sparks: SPARKS_CAPACITY,
      plasma: PLASMA_CAPACITY,
      smoke: SMOKE_CAPACITY,
    }),
  );

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

    const manager = managerRef.current;

    if (!manager.attach(refs)) {
      return;
    }

    manager.beginFrame();

    // Reuse a single context object and event key across the frame instead of
    // allocating an object plus seven strings per explosion event.
    let ctx: EffectUpdateContext | null = null;

    for (const event of state.explosions) {
      const derived = getDerived(event);
      if (ctx === null) {
        ctx = { event, time: event.elapsed, camera, derived, dummy, tmpQuat, tmpVec, color };
      } else {
        ctx.event = event;
        ctx.time = event.elapsed;
        ctx.derived = derived;
      }

      const keyBase = String(event.id);

      const flashMgr = manager.getEffectManager('flash');
      if (flashMgr) updateFlash(ctx, flashMgr, keyBase);

      const shockwaveMgr = manager.getEffectManager('shockwave');
      if (shockwaveMgr) updateShockwave(ctx, shockwaveMgr, keyBase);

      const fireballMgr = manager.getEffectManager('fireball');
      if (fireballMgr) updateFireball(ctx, fireballMgr, keyBase);

      const debrisMgr = manager.getEffectManager('debris');
      if (debrisMgr) updateDebris(ctx, debrisMgr, keyBase);

      const sparksMgr = manager.getEffectManager('sparks');
      if (sparksMgr) updateSparks(ctx, sparksMgr, keyBase);

      const plasmaMgr = manager.getEffectManager('plasma');
      if (plasmaMgr) updatePlasma(ctx, plasmaMgr, keyBase);

      const smokeMgr = manager.getEffectManager('smoke');
      if (smokeMgr) updateSmoke(ctx, smokeMgr, keyBase);
    }

    manager.finalize();

    const saturated = manager.anySaturated();
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
