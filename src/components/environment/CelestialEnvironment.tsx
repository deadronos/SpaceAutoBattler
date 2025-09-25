import { Suspense, useRef } from 'react';
import { CELESTIAL_ENVIRONMENT } from '../../config/environment.js';
import { PlanetBody } from './PlanetBody.js';
import { StarLight } from './StarLight.js';
import { StarDisk } from './StarDisk.js';
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
        {features?.starDisk !== false && (
          // StarDisk is rendered as a child of StarLight so it's parented in the scene graph
          <StarDisk
            config={starLight}
            enabled={true}
            size={CELESTIAL_ENVIRONMENT.starDisk?.size}
            opacity={CELESTIAL_ENVIRONMENT.starDisk?.opacity}
            distanceMultiplier={CELESTIAL_ENVIRONMENT.starDisk?.distanceMultiplier}
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
