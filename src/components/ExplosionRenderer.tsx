import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import type { ExplosionEvent } from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { useBloomRegistration } from '../renderer/BloomProvider.js';
import { useGameState } from '../game/context.js';

interface DerivedParticle {
  direction: Vector3;
  speed: number;
  lifetime: number;
  axis: Vector3;
  spin: number;
  scale: number;
}

interface DerivedSmoke {
  offset: Vector3;
  drift: Vector3;
  scale: number;
  lifetime: number;
}

interface DerivedExplosionData {
  flicker: number;
  debris: DerivedParticle[];
  sparks: DerivedParticle[];
  plasma: DerivedParticle[];
  smoke: DerivedSmoke[];
}

interface CachedDerived {
  seed: number;
  radius: number;
  hull: ExplosionEvent['hull'];
  data: DerivedExplosionData;
}

const MAX_EVENTS = 48;
const MAX_DEBRIS = 24;
const MAX_SPARKS = 32;
const MAX_PLASMA = 24;
const MAX_SMOKE = 28;

const FLASH_DURATION = 0.12;
const DEBRIS_DELAY = 0.18;
const SPARKS_DELAY = 0.22;
const PLASMA_DELAY = 0.25;
const SMOKE_DELAY = 0.3;
const SPARKS_LIFETIME = 0.35;
const PLASMA_LIFETIME = 0.9;
const SMOKE_LIFETIME = 1.8;

const FLASH_CAPACITY = MAX_EVENTS;
const SHOCKWAVE_CAPACITY = MAX_EVENTS;
const FIREBALL_CAPACITY = MAX_EVENTS;
const DEBRIS_CAPACITY = MAX_EVENTS * MAX_DEBRIS;
const SPARKS_CAPACITY = MAX_EVENTS * MAX_SPARKS;
const PLASMA_CAPACITY = MAX_EVENTS * MAX_PLASMA;
const SMOKE_CAPACITY = MAX_EVENTS * MAX_SMOKE;

const derivedCache = new WeakMap<ExplosionEvent, CachedDerived>();
const colorCache = new Map<string, Color>();

function getCachedColor(value: string): Color {
  let color = colorCache.get(value);
  if (!color) {
    color = new Color(value);
    colorCache.set(value, color);
  }
  return color;
}

function randomUnitVector(rng: SeededRng): Vector3 {
  const u = rng.next();
  const v = rng.next();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  return new Vector3(
    Math.cos(theta) * sinPhi,
    Math.sin(theta) * sinPhi,
    Math.cos(phi),
  );
}

function createDerived(event: ExplosionEvent): DerivedExplosionData {
  const rng = new SeededRng(Math.max(1, event.seed || 1));
  const debris: DerivedParticle[] = [];
  const sparks: DerivedParticle[] = [];
  const plasma: DerivedParticle[] = [];
  const smoke: DerivedSmoke[] = [];

  for (let i = 0; i < Math.min(event.debris.count, MAX_DEBRIS); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.debris.speed[0], event.debris.speed[1]);
    const lifetime = rng.range(0.55, 0.95);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.6, 1.2);
    debris.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.sparks, MAX_SPARKS); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.radius * 2.5, event.radius * 3.5);
    const lifetime = rng.range(0.2, SPARKS_LIFETIME);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.4, 0.9);
    sparks.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.plasma, MAX_PLASMA); i += 1) {
    const direction = randomUnitVector(rng).normalize();
    const speed = rng.range(event.radius * 0.8, event.radius * 1.6);
    const lifetime = rng.range(0.6, PLASMA_LIFETIME);
    const axis = randomUnitVector(rng).normalize();
    const spin = rng.range(-Math.PI, Math.PI);
    const scale = rng.range(0.8, 1.4);
    plasma.push({ direction, speed, lifetime, axis, spin, scale });
  }

  for (let i = 0; i < Math.min(event.particles.smoke, MAX_SMOKE); i += 1) {
    const offsetDir = randomUnitVector(rng).normalize();
    offsetDir.y = Math.abs(offsetDir.y);
    const driftDir = randomUnitVector(rng).normalize();
    driftDir.y = Math.abs(driftDir.y);
    const offset = offsetDir.multiplyScalar(event.radius * rng.range(0.15, 0.35));
    const drift = driftDir.multiplyScalar(rng.range(event.radius * 0.08, event.radius * 0.16));
    const scale = rng.range(0.6, 1.6);
    const lifetime = rng.range(1.1, SMOKE_LIFETIME);
    smoke.push({ offset, drift, scale, lifetime });
  }

  return {
    flicker: rng.range(0.85, 1.15),
    debris,
    sparks,
    plasma,
    smoke,
  };
}

function getDerived(event: ExplosionEvent): DerivedExplosionData {
  const cached = derivedCache.get(event);
  if (cached && cached.seed === event.seed && cached.radius === event.radius && cached.hull === event.hull) {
    return cached.data;
  }
  const data = createDerived(event);
  derivedCache.set(event, {
    seed: event.seed,
    radius: event.radius,
    hull: event.hull,
    data,
  });
  return data;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

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

  const dummy = useMemo(() => new Object3D(), []);
  const tmpQuat = useMemo(() => new Quaternion(), []);
  const tmpVec = useMemo(() => new Vector3(), []);
  const color = useMemo(() => new Color(), []);

  const flashGeometry = useMemo(() => new SphereGeometry(1, 16, 16), []);
  const shockwaveGeometry = useMemo(() => new RingGeometry(0.5, 0.7, 32), []);
  const fireballGeometry = useMemo(() => new SphereGeometry(1, 20, 16), []);
  const debrisGeometry = useMemo(() => new TetrahedronGeometry(0.4, 0), []);
  const sparkGeometry = useMemo(() => new SphereGeometry(0.2, 8, 6), []);
  const plasmaGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const smokeGeometry = useMemo(() => new PlaneGeometry(1, 1), []);

  const flashMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    mat.toneMapped = false;
    return mat;
  }, []);

  const shockwaveMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    mat.toneMapped = false;
    return mat;
  }, []);

  const fireballMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#ff8844'),
      emissive: new Color('#ff5500'),
      emissiveIntensity: 2.2,
      roughness: 0.6,
      metalness: 0,
    });
    mat.toneMapped = true;
    return mat;
  }, []);

  const debrisMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#ffaa66'),
      emissive: new Color('#ff9966'),
      emissiveIntensity: 1.6,
      roughness: 0.8,
      metalness: 0.1,
    });
    mat.toneMapped = true;
    return mat;
  }, []);

  const sparksMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color: new Color('#ffcc88'),
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    mat.toneMapped = false;
    return mat;
  }, []);

  const plasmaMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color: new Color('#ff9955'),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    mat.toneMapped = false;
    return mat;
  }, []);

  const smokeMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color: new Color('#555555'),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: DoubleSide,
    });
    mat.toneMapped = true;
    return mat;
  }, []);

  useEffect(() => () => {
    flashGeometry.dispose();
    shockwaveGeometry.dispose();
    fireballGeometry.dispose();
    debrisGeometry.dispose();
    sparkGeometry.dispose();
    plasmaGeometry.dispose();
    smokeGeometry.dispose();
    flashMaterial.dispose();
    shockwaveMaterial.dispose();
    fireballMaterial.dispose();
    debrisMaterial.dispose();
    sparksMaterial.dispose();
    plasmaMaterial.dispose();
    smokeMaterial.dispose();
  }, [
    debrisGeometry,
    debrisMaterial,
    fireballGeometry,
    fireballMaterial,
    flashGeometry,
    flashMaterial,
    plasmaGeometry,
    plasmaMaterial,
    shockwaveGeometry,
    shockwaveMaterial,
    smokeGeometry,
    smokeMaterial,
    sparkGeometry,
    sparksMaterial,
  ]);

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
        args={[flashGeometry, flashMaterial, FLASH_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={shockwaveRef}
        args={[shockwaveGeometry, shockwaveMaterial, SHOCKWAVE_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={fireballRef}
        args={[fireballGeometry, fireballMaterial, FIREBALL_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={debrisRef}
        args={[debrisGeometry, debrisMaterial, DEBRIS_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparksRef}
        args={[sparkGeometry, sparksMaterial, SPARKS_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={plasmaRef}
        args={[plasmaGeometry, plasmaMaterial, PLASMA_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={smokeRef}
        args={[smokeGeometry, smokeMaterial, SMOKE_CAPACITY]}
        frustumCulled={false}
      />
    </group>
  );
}

export function DynamicLightManager(): React.ReactElement {
  const state = useGameState();
  const groupRef = useRef<Group>(null);
  const lightsRef = useRef<PointLight[]>([]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const events = state.explosions;
    const lights = lightsRef.current;

    while (lights.length < MAX_EVENTS) {
      const light = new PointLight('#ffffff', 0, 0, 2);
      light.castShadow = false;
      light.visible = false;
      group.add(light);
      lights.push(light);
    }

    let active = 0;
    for (const event of events) {
      if (active >= lights.length) break;
      const light = lights[active];
      const lightPhase = event.lightDuration > 0 ? event.lightElapsed / event.lightDuration : 1;
      const intensity = event.flashIntensity * Math.max(0, 1 - lightPhase);
      light.visible = intensity > 0.02;
      light.intensity = intensity * 6;
      light.decay = Math.max(0.8, event.lightFalloff / 100);
      light.distance = event.radius * 6;
      light.color.set(event.lightColor as any);
      light.position.copy(event.position);
      active += 1;
    }

    for (let i = active; i < lights.length; i += 1) {
      lights[i].visible = false;
    }
  });

  return <group ref={groupRef} />;
}

export function ExplosionsLayer(): React.ReactElement {
  return (
    <group>
      <ExplosionRenderer />
      <DynamicLightManager />
    </group>
  );
}
