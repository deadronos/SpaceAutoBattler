import { useEffect, useMemo, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
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

const DEFAULT_FILL_COLOR = '#5c82cc';
const DEFAULT_FILL_INTENSITY = 0.3;
const DEFAULT_ENV_INTENSITY = 0.45;
const LIGHTFORMER_RADIUS = 10;

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

  const { position, fillPosition, keyDir } = useMemo(() => {
    const direction = new Vector3(config.direction.x, config.direction.y, config.direction.z);
    if (direction.lengthSq() === 0) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }
    const distance = Math.max(config.distance, 1);
    const keyPos = direction.clone().multiplyScalar(-distance).toArray() as [
      number,
      number,
      number,
    ];
    const oppositePos = direction.clone().multiplyScalar(distance).toArray() as [
      number,
      number,
      number,
    ];
    return {
      position: keyPos,
      fillPosition: oppositePos,
      keyDir: [direction.x, direction.y, direction.z] as const,
    };
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance]);

  const fillColor = config.fillColor ?? DEFAULT_FILL_COLOR;
  const fillIntensity = config.fillIntensity ?? DEFAULT_FILL_INTENSITY;
  const environmentIntensity = config.environmentIntensity ?? DEFAULT_ENV_INTENSITY;

  // Memoize procedural Lightformers so EnvironmentPortal does not re-bake its
  // cubemap on parent re-renders and makes zero external HDR network requests.
  const lightformers = useMemo(() => {
    const [dx, dy, dz] = keyDir;
    return (
      <>
        <Lightformer
          form="circle"
          intensity={2}
          color={config.color}
          scale={8}
          position={[-dx * LIGHTFORMER_RADIUS, -dy * LIGHTFORMER_RADIUS, -dz * LIGHTFORMER_RADIUS]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color={fillColor}
          scale={[14, 8, 1]}
          position={[dx * LIGHTFORMER_RADIUS, dy * LIGHTFORMER_RADIUS, dz * LIGHTFORMER_RADIUS]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#3a5a96"
          scale={[12, 12, 1]}
          position={[0, LIGHTFORMER_RADIUS, 0]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.4}
          color="#243558"
          scale={[12, 12, 1]}
          position={[0, -LIGHTFORMER_RADIUS, 0]}
          target={[0, 0, 0]}
        />
      </>
    );
  }, [config.color, fillColor, keyDir]);

  useEffect(() => {
    const light = internalLightRef.current;
    if (!light || !light.shadow) {
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
      {environmentIntensity > 0 && (
        <Environment resolution={64} frames={1} environmentIntensity={environmentIntensity}>
          {lightformers}
        </Environment>
      )}
      {fillIntensity > 0 && (
        <directionalLight
          position={fillPosition}
          intensity={fillIntensity}
          color={fillColor}
          castShadow={false}
        />
      )}
      {/* The group is positioned where the directional light should be; children will be parented here */}
      <group position={position}>
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
