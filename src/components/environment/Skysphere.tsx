import { memo, useEffect } from 'react';
import { BackSide, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import {
  SKYSPHERE_TEXTURE_PATHS,
  SKYSPHERE_LOWRES_TEXTURE_PATHS,
  type SkyspherTextureKey,
} from '../../assets/skysphere.js';
import { useProgressiveTexture } from '../../hooks/useProgressiveTexture.js';
import { applyTextureSettings } from '../../utils/textureUtils.js';

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
  // Load the skysphere texture progressively (low-res first, then high-res)
  const { texture } = useProgressiveTexture(
    SKYSPHERE_LOWRES_TEXTURE_PATHS[textureKey],
    SKYSPHERE_TEXTURE_PATHS[textureKey],
  );

  // Configure texture for optimal skysphere rendering
  useEffect(() => {
    if (texture) {
      applyTextureSettings(texture, {
        colorSpace: SRGBColorSpace,
        minFilter: LinearMipmapLinearFilter,
        magFilter: LinearFilter,
        flipY: false,
        needsUpdate: true,
      });
    }
  }, [texture]);

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
