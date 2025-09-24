import { Suspense } from 'react';
import { CELESTIAL_ENVIRONMENT } from '../../config/environment.js';
import { PlanetBody } from './PlanetBody.js';
import { StarLight } from './StarLight.js';
import { StarDisk } from './StarDisk.js';
import { ParallaxBillboard } from './ParallaxBillboard.js';

export function CelestialEnvironment(): React.ReactElement {
  const { starLight, planets, parallaxBillboards, features } = CELESTIAL_ENVIRONMENT;
  
  return (
    <group>
      <StarLight config={starLight} />
      {features?.starDisk !== false && (
        <StarDisk config={starLight} enabled={true} />
      )}
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
