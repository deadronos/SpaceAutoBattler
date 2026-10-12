import { useEffect, useMemo, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { Object3D, Vector3 } from 'three';
import type { StarLightConfig } from '../../config/environment.js';
import { computeShadowCameraParams } from '../../renderer/shadowCamera.js';
import { useUiStore } from '../../app/uiStore.js';
import { resolveQualitySettings } from '../../config/quality.js';
import { reportLifecycleError } from '../../utils/errorReporting.js';

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

  // Resolved quality knobs (render-only). `high` keeps the shipped 2048 map and
  // shadows on, so this is a no-op by default.
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const quality = resolveQualitySettings(qualityPreset, detectedQualityTier);
  const shadowsEnabled = quality.shadows;
  const shadowMapSize = quality.shadowMapSize;

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
    light.castShadow = shadowsEnabled;
    const shadow = light.shadow;
    shadow.mapSize.set(shadowMapSize, shadowMapSize);
    shadow.needsUpdate = true;
    shadow.bias = -0.0002;
    shadow.normalBias = 0.02;
    const camera = shadow.camera;
    const { near, far, halfSize } = computeShadowCameraParams(config.distance);
    camera.near = near;
    camera.far = far;
    camera.left = -halfSize;
    camera.right = halfSize;
    camera.top = halfSize;
    camera.bottom = -halfSize;
    camera.updateProjectionMatrix();
    // Mirror the internal ref into the optional external ref so parents can access it
    if (externalLightRef) {
      try {
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        (externalLightRef as any).current = light;
      } catch (error) {
        reportLifecycleError('update', 'StarLightRef', undefined, error);
      }
    }
  }, [target, externalLightRef, config.distance, shadowsEnabled, shadowMapSize]);

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
          castShadow={shadowsEnabled}
        />
        {children}
      </group>
      <primitive object={target} />
    </>
  );
}
