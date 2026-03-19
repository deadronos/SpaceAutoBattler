import { Suspense } from 'react';
import { CELESTIAL_ENVIRONMENT } from '../../config/environment.js';
import { PlanetBody } from './PlanetBody.js';
import { StarLight } from './StarLight.js';
import { StarSphere } from './StarSphere.js';
import { ParallaxBillboard } from './ParallaxBillboard.js';
import { Skysphere } from './Skysphere.js';
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
          // StarSphere replaces the old StarDisk billboard. It is parented
          // under StarLight so it can use the StarLight config to compute
          // its local offset and orientation. Pass through the global
          // starDisk appearance settings so the two implementations stay
          // visually consistent.
          <StarSphere
            key={'StarSphere'}
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
