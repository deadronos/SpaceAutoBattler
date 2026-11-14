import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, PointLight, Vector3 } from 'three';
import { useGameState } from '../../app/context.js';
import type { ExplosionEvent } from '../../types/index.js';

const MAX_EXPLOSION_LIGHTS = 8;
const LIGHT_SLOTS = Array.from({ length: MAX_EXPLOSION_LIGHTS }, (_, index) => index);

interface LightCandidate {
  event: ExplosionEvent | null;
  intensity: number;
  score: number;
}

export function DynamicLightManager(): React.ReactElement {
  const state = useGameState();
  const groupRef = useRef<Group>(null);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const candidatesRef = useRef(
    LIGHT_SLOTS.map((): LightCandidate => ({
      event: null,
      intensity: 0,
      score: 0,
    })),
  );

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    camera.getWorldPosition(cameraPosition);

    const candidates = candidatesRef.current;
    let active = 0;
    for (const event of state.explosions) {
      const lightDuration = event.lightDuration ?? 0;
      const phase = lightDuration > 0 ? event.lightElapsed / lightDuration : 1;
      const intensity = (event.flashIntensity ?? 0) * Math.max(0, 1 - phase);
      if (intensity <= 0.02) continue;

      // Prioritize bright nearby flashes, with event order breaking ties.
      const score = intensity / (1 + cameraPosition.distanceToSquared(event.position));
      let index = active;
      while (index > 0 && score > candidates[index - 1]!.score) index -= 1;
      if (index === MAX_EXPLOSION_LIGHTS) continue;

      const last = Math.min(active, MAX_EXPLOSION_LIGHTS - 1);
      const candidate = candidates[last]!;
      for (let i = last; i > index; i -= 1) candidates[i] = candidates[i - 1]!;
      candidates[index] = candidate;
      candidate.event = event;
      candidate.intensity = intensity;
      candidate.score = score;
      active = Math.min(active + 1, MAX_EXPLOSION_LIGHTS);
    }

    for (let i = 0; i < group.children.length; i += 1) {
      const light = group.children[i] as PointLight;
      const candidate = candidates[i]!;
      const event = i < active ? candidate.event : null;
      light.visible = event !== null;
      if (event) {
        light.intensity = candidate.intensity * 6;
        light.decay = Math.max(0.8, (event.lightFalloff ?? 0) / 100);
        light.distance = event.radius * 6;
        light.color.set(event.lightColor ?? '#ffffff');
        light.position.copy(event.position);
      }
      candidate.event = null;
    }
  });

  return (
    <group ref={groupRef}>
      {LIGHT_SLOTS.map((index) => (
        <pointLight key={index} intensity={0} visible={false} />
      ))}
    </group>
  );
}
