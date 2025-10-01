import React from 'react';

export const BulletLaserMaterial: React.FC = () => (
  <meshStandardMaterial color="#ffd089" emissive="#ff962f" emissiveIntensity={1.8} />
);

export const BulletPlasmaMaterial: React.FC = () => (
  <meshStandardMaterial color="#c78bff" emissive="#a04bff" emissiveIntensity={2.2} roughness={0.2} metalness={0.1} />
);

export const BulletIonMaterial: React.FC = () => (
  <meshStandardMaterial color="#bfe9ff" emissive="#6fe8ff" emissiveIntensity={3.0} roughness={0.05} metalness={0.0} />
);

export const BulletHeavyMaterial: React.FC = () => (
  <meshStandardMaterial color="#ffd6b3" emissive="#ffb36b" emissiveIntensity={1.2} roughness={0.6} metalness={0.2} />
);
