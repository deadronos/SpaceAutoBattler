import { useEffect, useMemo, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { Object3D, Vector3 } from 'three';
import type { StarLightConfig } from '../../config/environment.js';

interface StarLightProps {
  config: StarLightConfig;
  /** Optional external ref so other components (like StarDisk) can follow the light */
  externalLightRef?: React.RefObject<DirectionalLight | null>;
  children?: React.ReactNode;
}

export function StarLight({
  config,
  externalLightRef,
  children,
}: StarLightProps): React.ReactElement {
  const internalLightRef = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);

  const position = useMemo(() => {
    const direction = new Vector3(
      config.direction.x,
      config.direction.y,
      config.direction.z,
    ).normalize();
    const distance = Math.max(config.distance, 1);
    return direction.multiplyScalar(-distance).toArray();
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance]);

  useEffect(() => {
    const light = internalLightRef.current;
    if (!light) {
      return;
    }
    target.position.set(0, 0, 0);
    light.target = target;
    light.castShadow = true;
    const shadow = light.shadow;
    shadow.mapSize.set(2048, 2048);
    shadow.bias = -0.0002;
    shadow.normalBias = 0.02;
    const camera = shadow.camera;
    const span = Math.max(config.distance * 0.6, 1000);
    camera.near = 1;
    camera.far = Math.max(config.distance * 2, span * 1.25);
    camera.left = -span;
    camera.right = span;
    camera.top = span;
    camera.bottom = -span;
    camera.updateProjectionMatrix();
    // Mirror the internal ref into the optional external ref so parents can access it
    if (externalLightRef) {
      try {
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        (externalLightRef as any).current = light;
      } catch {
        // noop: if external ref is read-only we ignore
      }
    }
  }, [target, externalLightRef, config.distance]);

  return (
    <>
      <ambientLight
        color={config.ambientColor ?? '#1a2236'}
        intensity={config.ambientIntensity ?? 0.4}
      />
      {/* The group is positioned where the directional light should be; children will be parented here */}
      <group position={position as [number, number, number]}>
        <directionalLight
          ref={internalLightRef}
          position={[0, 0, 0]}
          intensity={config.intensity}
          color={config.color}
          castShadow={true}
        />
        {children}
      </group>
      <primitive object={target} />
    </>
  );
}
