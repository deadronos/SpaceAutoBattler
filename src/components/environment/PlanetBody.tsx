import { memo, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { Color, Euler, Quaternion, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { useOptionalGameState } from '../../game/context.js';
import { usePlanetTexture } from '../../hooks/usePlanetTexture.js';
import type { PlanetBodyConfig } from '../../config/environment.js';
import { PLANET_GEOMETRY_SEGMENTS } from '../../config/environment.js';
import { PlanetRimMaterial } from './PlanetRimMaterial.js';
import { PlanetRings } from './PlanetRings.js';

interface PlanetBodyProps {
  config: PlanetBodyConfig;
}

export const PlanetBody = memo(function PlanetBody({ config }: PlanetBodyProps): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const state = useOptionalGameState();
  const { texture, fallbackColor, error } = usePlanetTexture(config.textureKey);

  const tiltQuat = useMemo(() => {
    if (!config.tilt) {
      return new Quaternion();
    }
    return new Quaternion().setFromEuler(new Euler(config.tilt.x, config.tilt.y, config.tilt.z, 'XYZ'));
  }, [config.tilt?.x, config.tilt?.y, config.tilt?.z]);

  const rotationAxis = useMemo(() => {
    if (!config.rotation) {
      return null;
    }
    return new Vector3(config.rotation.axis.x, config.rotation.axis.y, config.rotation.axis.z).normalize();
  }, [config.rotation?.axis.x, config.rotation?.axis.y, config.rotation?.axis.z]);

  const workingQuat = useMemo(() => new Quaternion(), []);
  const spinQuat = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    workingQuat.copy(tiltQuat);

    if (config.rotation && rotationAxis) {
      const sim = state?.simulation;
      const elapsed = sim ? sim.lastTickStart + sim.alpha * sim.step : 0;
      const angle = (config.rotation.offset ?? 0) + elapsed * config.rotation.speed;
      spinQuat.setFromAxisAngle(rotationAxis, angle);
      workingQuat.multiply(spinQuat);
    }

    group.quaternion.copy(workingQuat);
  });

  const emissiveColor = useMemo(() => new Color(fallbackColor).multiplyScalar(1.2), [fallbackColor]);
  const emissiveIntensity = config.emissiveBoost ?? 0.05;
  const useRimGlow = (config.rimStrength ?? 0) > 0;

  if (error) {
    console.warn('[PlanetBody] Missing texture key', config.id, error);
  }

  return (
    <group ref={groupRef} position={[config.position.x, config.position.y, config.position.z]}>
      <mesh>
        <sphereGeometry args={[config.radius, PLANET_GEOMETRY_SEGMENTS.width, PLANET_GEOMETRY_SEGMENTS.height]} />
        {useRimGlow ? (
          <PlanetRimMaterial
            map={texture ?? undefined}
            color={texture ? undefined : fallbackColor}
            emissive={emissiveColor}
            emissiveIntensity={texture ? emissiveIntensity : emissiveIntensity * 0.6}
            rimStrength={config.rimStrength ?? 0}
            rimColor={config.rimColor ?? '#ffffff'}
            metalness={0}
            roughness={0.85}
          />
        ) : (
          <meshStandardMaterial
            attach="material"
            map={texture ?? undefined}
            color={texture ? undefined : fallbackColor}
            metalness={0}
            roughness={0.85}
            emissive={emissiveColor}
            emissiveIntensity={texture ? emissiveIntensity : emissiveIntensity * 0.6}
          />
        )}
      </mesh>
      {config.rings && (
        <PlanetRings
          innerRadius={config.rings.innerRadius}
          outerRadius={config.rings.outerRadius}
          color={config.rings.color}
          opacity={config.rings.opacity}
          rotationSpeed={config.rings.rotationSpeed}
          enabled={true}
        />
      )}
    </group>
  );
});
