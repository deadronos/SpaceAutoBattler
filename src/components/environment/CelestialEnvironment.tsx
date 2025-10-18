import { Suspense, useRef } from 'react';
import { CELESTIAL_ENVIRONMENT } from '../../config/environment.js';
import { PlanetBody } from './PlanetBody.js';
import { StarLight } from './StarLight.js';
import { StarSphere } from './StarSphere.js';
// Note: `StarDisk` is a legacy billboard implementation. We avoid importing
// it eagerly to reduce bundle size and only load it when an explicit
// feature flag requests the legacy component.
import { ParallaxBillboard } from './ParallaxBillboard.js';
import { Skysphere } from './Skysphere.js';
import type { DirectionalLight } from 'three';

export function CelestialEnvironment(): React.ReactElement {
  const { starLight, skysphere, planets, parallaxBillboards, features } = CELESTIAL_ENVIRONMENT;
  return (
    <group>
      {/* Skysphere renders first to ensure it's behind everything else */}
      {features?.skysphere !== false && skysphere && (
        <Suspense fallback={null}>
          <Skysphere
            textureKey={skysphere.textureKey}
            radius={skysphere.radius}
            opacity={skysphere.opacity}
          />
        </Suspense>
      )}
      <StarLight config={starLight}>
        {/* Prefer the new `StarSphere` implementation by default. If the
            runtime configuration explicitly requests the legacy StarDisk
            (`features.starDisk === true`) we dynamically import and render
            it so existing automation can opt in while we migrate tests/docs.
        */}
        {features?.starDisk === true ? (
          // Dynamic import to avoid bundling StarDisk unless explicitly needed
          // eslint-disable-next-line react/no-unstable-nested-components
          (() => {
            const LegacyStarDisk = require('./StarDisk.js').StarDisk;
            return (
              <LegacyStarDisk
                key={"StarDisk"}
                config={starLight}
                enabled={true}
                size={CELESTIAL_ENVIRONMENT.starDisk?.size}
                opacity={CELESTIAL_ENVIRONMENT.starDisk?.opacity}
                distanceMultiplier={CELESTIAL_ENVIRONMENT.starDisk?.distanceMultiplier}
                haze={CELESTIAL_ENVIRONMENT.starDisk?.haze}
                boundary={CELESTIAL_ENVIRONMENT.starDisk?.boundary}
                depthCoreRadius={CELESTIAL_ENVIRONMENT.starDisk?.depthCoreRadius}
              />
            );
          })()
        ) : (
          <StarSphere
            key={"StarSphere"}
            config={starLight}
            enabled={true}
            size={CELESTIAL_ENVIRONMENT.starDisk?.size}
            opacity={CELESTIAL_ENVIRONMENT.starDisk?.opacity}
            distanceMultiplier={CELESTIAL_ENVIRONMENT.starDisk?.distanceMultiplier}
            haze={CELESTIAL_ENVIRONMENT.starDisk?.haze}
            boundary={CELESTIAL_ENVIRONMENT.starDisk?.boundary}
            depthCoreRadius={CELESTIAL_ENVIRONMENT.starDisk?.depthCoreRadius}
          />
        )}
      </StarLight>
      <Suspense fallback={null}>
        {planets.map((planet) => (
          <PlanetBody key={planet.id} config={planet} />
        ))}
      </Suspense>
      {features?.parallaxBillboards !== false && parallaxBillboards && (
        <>
          {parallaxBillboards.map((billboard) => (
            <ParallaxBillboard
              key={billboard.id}
              position={billboard.position}
              size={billboard.size}
              color={billboard.color}
              opacity={billboard.opacity}
              parallaxFactor={billboard.parallaxFactor}
              enabled={true}
            />
          ))}
        </>
      )}
    </group>
  );
}
