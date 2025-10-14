import type React from 'react';
import type { Archetype, GameEntity } from '../../types/index.js';
import { BeamVisualsInstancedLayer } from './BeamVisualsInstancedLayer.js';

interface BeamVisualsLayerProps {
  archetype: Archetype<GameEntity, ['beamVisual']>;
}

export function BeamVisualsLayer(props: BeamVisualsLayerProps): React.ReactElement {
  return <BeamVisualsInstancedLayer {...props} />;
}
