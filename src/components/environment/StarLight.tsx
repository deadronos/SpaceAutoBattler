import { useEffect, useMemo, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { Object3D, Vector3 } from 'three';
import type { StarLightConfig } from '../../config/environment.js';

interface StarLightProps {
  config: StarLightConfig;
}

export function StarLight({ config }: StarLightProps): React.ReactElement {
  const lightRef = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);

  const position = useMemo(() => {
    const direction = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance, 1);
    return direction.multiplyScalar(-distance).toArray();
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance]);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) {
      return;
    }
    target.position.set(0, 0, 0);
    light.target = target;
  }, [target]);

  return (
    <>
      <ambientLight color={config.ambientColor ?? '#1a2236'} intensity={config.ambientIntensity ?? 0.4} />
      <directionalLight
        ref={lightRef}
        position={position as [number, number, number]}
        intensity={config.intensity}
        color={config.color}
        castShadow={false}
      />
      <primitive object={target} />
    </>
  );
}
