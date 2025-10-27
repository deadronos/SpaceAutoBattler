import React from 'react';
import { explosionSmokePreset } from './materialPresets.js';

export const ExplosionSmokeMaterial: React.FC = () => (
  <meshStandardMaterial {...explosionSmokePreset} />
);
