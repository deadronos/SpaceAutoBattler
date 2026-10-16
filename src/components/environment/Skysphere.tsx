import { memo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BackSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';
import {
  SKYSPHERE_LOWRES_TEXTURE_PATHS,
  selectSkysphereHighResUrl,
  type SkyspherTextureKey,
} from '../../assets/skysphere.js';
import { useUiStore } from '../../app/uiStore.js';
import { resolveQualitySettings } from '../../config/quality.js';
import { useProgressiveTexture } from '../../hooks/useProgressiveTexture.js';
import { applyTextureSettings } from '../../utils/textureUtils.js';

/** Configure a skysphere texture before its first GPU upload. */
function configureSkysphereTexture(texture: Texture): void {
  applyTextureSettings(texture, {
    colorSpace: SRGBColorSpace,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    flipY: false,
    needsUpdate: true,
  });
}

interface SkysphereProps {
  /** Key to select skysphere texture */
  textureKey: SkyspherTextureKey;
  /** Radius of the skysphere in world units */
  radius?: number;
  /** Overall opacity of the skysphere */
  opacity?: number;
}

export const Skysphere = memo(function Skysphere({
  textureKey,
  radius = 50000,
  opacity = 1.0,
}: SkysphereProps): React.ReactElement {
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const maxTextureSize = useThree((s) => s.gl.capabilities?.maxTextureSize);
  const { skysphereMaxSize } = resolveQualitySettings(qualityPreset, detectedQualityTier);

  // Load the skysphere texture progressively (low-res first, then the tier's high-res variant)
  const { texture } = useProgressiveTexture(
    SKYSPHERE_LOWRES_TEXTURE_PATHS[textureKey],
    selectSkysphereHighResUrl(textureKey, skysphereMaxSize, maxTextureSize),
    configureSkysphereTexture,
  );

  return (
    <mesh scale={[radius, radius, radius]} frustumCulled={false}>
      {/* Sphere geometry with inward-facing normals */}
      <sphereGeometry args={[1, 64, 32]} />
      <meshBasicMaterial
        map={texture}
        side={BackSide} // Render inside of sphere
        transparent={opacity < 1.0}
        opacity={opacity}
        depthWrite={false} // Render behind all other objects
        fog={false} // Don't apply fog to the skysphere
      />
    </mesh>
  );
});
