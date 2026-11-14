import React, { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import { useGameState } from '../../app/context.js';
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
import { ExplosionsInstancedManager } from './instancedManager.js';
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
  const manager = useMemo(
    () =>
      new ExplosionsInstancedManager({
        flash: FLASH_CAPACITY,
        shockwave: SHOCKWAVE_CAPACITY,
        fireball: FIREBALL_CAPACITY,
        debris: DEBRIS_CAPACITY,
        sparks: SPARKS_CAPACITY,
        plasma: PLASMA_CAPACITY,
        smoke: SMOKE_CAPACITY,
      }),
    [],
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
  const bindFlash = useCallback(
    (mesh: InstancedMesh | null) => {
      flashRef.current = mesh;
      manager.attachMesh('flash', mesh);
    },
    [manager],
  );
  const bindShockwave = useCallback(
    (mesh: InstancedMesh | null) => {
      shockwaveRef.current = mesh;
      manager.attachMesh('shockwave', mesh);
    },
    [manager],
  );
  const bindFireball = useCallback(
    (mesh: InstancedMesh | null) => {
      fireballRef.current = mesh;
      manager.attachMesh('fireball', mesh);
    },
    [manager],
  );
  const bindDebris = useCallback(
    (mesh: InstancedMesh | null) => manager.attachMesh('debris', mesh),
    [manager],
  );
  const bindSparks = useCallback(
    (mesh: InstancedMesh | null) => manager.attachMesh('sparks', mesh),
    [manager],
  );
  const bindPlasma = useCallback(
    (mesh: InstancedMesh | null) => manager.attachMesh('plasma', mesh),
    [manager],
  );
  const bindSmoke = useCallback(
    (mesh: InstancedMesh | null) => manager.attachMesh('smoke', mesh),
    [manager],
  );

  useFrame(({ camera }) => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    manager.beginFrame();

    // Reuse a single context object across the frame instead of allocating
    // an object plus seven strings per explosion event. Numeric event ids
    // are passed straight through as allocation keys.
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

      const eventId = event.id;

      const flashMgr = manager.getEffectManager('flash');
      if (flashMgr) updateFlash(ctx, flashMgr, eventId);

      const shockwaveMgr = manager.getEffectManager('shockwave');
      if (shockwaveMgr) updateShockwave(ctx, shockwaveMgr, eventId);

      const fireballMgr = manager.getEffectManager('fireball');
      if (fireballMgr) updateFireball(ctx, fireballMgr, eventId);

      const debrisMgr = manager.getEffectManager('debris');
      if (debrisMgr) updateDebris(ctx, debrisMgr, eventId);

      const sparksMgr = manager.getEffectManager('sparks');
      if (sparksMgr) updateSparks(ctx, sparksMgr, eventId);

      const plasmaMgr = manager.getEffectManager('plasma');
      if (plasmaMgr) updatePlasma(ctx, plasmaMgr, eventId);

      const smokeMgr = manager.getEffectManager('smoke');
      if (smokeMgr) updateSmoke(ctx, smokeMgr, eventId);
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
      <instancedMesh ref={bindFlash} args={[geometries.flash, materials.flash, FLASH_CAPACITY]} />
      <instancedMesh
        ref={bindShockwave}
        args={[geometries.shockwave, materials.shockwave, SHOCKWAVE_CAPACITY]}
      />
      <instancedMesh
        ref={bindFireball}
        args={[geometries.fireball, materials.fireball, FIREBALL_CAPACITY]}
      />
      <instancedMesh
        ref={bindDebris}
        args={[geometries.debris, materials.debris, DEBRIS_CAPACITY]}
      />
      <instancedMesh
        ref={bindSparks}
        args={[geometries.sparks, materials.sparks, SPARKS_CAPACITY]}
      />
      <instancedMesh
        ref={bindPlasma}
        args={[geometries.plasma, materials.plasma, PLASMA_CAPACITY]}
      />
      <instancedMesh ref={bindSmoke} args={[geometries.smoke, materials.smoke, SMOKE_CAPACITY]} />
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
