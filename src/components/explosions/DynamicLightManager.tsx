import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, PointLight } from 'three';
import { useGameState } from '../../game/context.js';
import { MAX_EVENTS } from './constants.js';

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
      if (!light) continue;
      const lightDuration = event.lightDuration ?? 0;
      const lightPhase = lightDuration > 0 ? event.lightElapsed / lightDuration : 1;
      const intensity = (event.flashIntensity ?? 0) * Math.max(0, 1 - lightPhase);
      light.visible = intensity > 0.02;
      light.intensity = intensity * 6;
      light.decay = Math.max(0.8, (event.lightFalloff ?? 0) / 100);
      light.distance = (event.radius ?? 0) * 6;
      if (event.lightColor) light.color.set(event.lightColor);
      if (event.position) light.position.copy(event.position);
      active += 1;
    }

    for (let i = active; i < lights.length; i += 1) {
      const light = lights[i];
      if (light) light.visible = false;
    }
  });

  return <group ref={groupRef} />;
}
