import { Suspense } from 'react';
import { CELESTIAL_ENVIRONMENT } from '../../config/environment.js';
import { PlanetBody } from './PlanetBody.js';
import { StarLight } from './StarLight.js';
import { StarDisk } from './StarDisk.js';

export function CelestialEnvironment(): React.ReactElement {
  const { starLight, planets } = CELESTIAL_ENVIRONMENT;
  return (
    <group>
      <StarLight config={starLight} />
      <StarDisk config={starLight} enabled={true} />
      <Suspense fallback={null}>
        {planets.map((planet) => (
          <PlanetBody key={planet.id} config={planet} />
        ))}
      </Suspense>
    </group>
  );
}
