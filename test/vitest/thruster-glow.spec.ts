import { describe, expect, it } from 'vite-plus/test';
import fs from 'fs';
import path from 'path';

describe('Thruster glow enhancement', () => {
  it('has fallback anchor computation logic in useShipThrusters hook', () => {
    const file = path.resolve(__dirname, '../../src/hooks/useShipThrusters.ts');
    const txt = fs.readFileSync(file, 'utf-8');

    // Check for fallback anchor computation
    expect(txt).toContain('if (engines.length === 0)');
    expect(txt).toContain('anchorsByHull');
    expect(txt).toContain('THRUSTER_GLOW_CONFIG');

    // Check for dark emissive detection
    expect(txt).toContain('darkEmissiveThreshold');
    expect(txt).toContain('emissiveLuminance');

    // Check for glow mesh creation
    expect(txt).toContain('SphereGeometry');
    expect(txt).toContain('fallbackGlowMeshesRef');
  });

  it('has thruster glow configuration in effects config', () => {
    const file = path.resolve(__dirname, '../../src/config/effects.ts');
    const txt = fs.readFileSync(file, 'utf-8');

    // Check for thruster glow config
    expect(txt).toContain('ThrusterGlowConfig');
    expect(txt).toContain('THRUSTER_GLOW_CONFIG');
    expect(txt).toContain('defaultEmissiveColor');
    expect(txt).toContain('anchorsByHull');

    // Check anchor counts per hull
    expect(txt).toContain('fighter: 1');
    expect(txt).toContain('corvette: 2');
    expect(txt).toContain('destroyer: 4');
    expect(txt).toContain('carrier: 6');
  });

  it('preserves existing thruster functionality', () => {
    const thrusterFile = path.resolve(__dirname, '../../src/hooks/useShipThrusters.ts');
    const thrusterTxt = fs.readFileSync(thrusterFile, 'utf-8');

    // Check that name-based detection is still first priority
    expect(thrusterTxt).toContain('nameMatch');
    expect(thrusterTxt).toContain("n.includes('engine')");
    expect(thrusterTxt).toContain("n.includes('thruster')");
    expect(thrusterTxt).toContain("n.includes('exhaust')");

    // Check thruster intensity scaling function is properly defined
    expect(thrusterTxt).toContain('updateThrusterIntensity');
    expect(thrusterTxt).toContain('baseIntensity');
    expect(thrusterTxt).toContain('throttle');

    // Verify usage of thruster intensity scaling in Ship component
    const shipFile = path.resolve(__dirname, '../../src/components/Ship.tsx');
    const shipTxt = fs.readFileSync(shipFile, 'utf-8');
    expect(shipTxt).toContain('smoothing.thrusterIntensity.base');
    expect(shipTxt).toContain('smoothing.thrusterIntensity.range');
  });

  it('has particle trails component integration', () => {
    const file = path.resolve(__dirname, '../../src/components/ParticleTrails.tsx');
    expect(fs.existsSync(file)).toBe(true);

    const txt = fs.readFileSync(file, 'utf-8');

    // Check for particle system functionality
    expect(txt).toContain('ParticleTrails');
    expect(txt).toContain('useThrusterAnchors');
    expect(txt).toContain('InstancedBufferGeometry');
    expect(txt).toContain('ShaderMaterial');
    expect(txt).toContain('resolveThrusterAnchorsWorld');
    expect(txt).toContain('throttle');

    const resourcesFile = path.resolve(__dirname, '../../src/renderer/particles/trailResources.ts');
    const resourcesTxt = fs.readFileSync(resourcesFile, 'utf-8');
    expect(resourcesTxt).toContain('createParticleTrailResources');
    expect(resourcesTxt).toContain('ParticleTrailResources');

    // Check it's integrated in Battlefield
    const battlefieldFile = path.resolve(__dirname, '../../src/components/Battlefield.tsx');
    const battlefieldTxt = fs.readFileSync(battlefieldFile, 'utf-8');
    expect(battlefieldTxt).toContain('ParticleTrails');
    expect(battlefieldTxt).toContain('<ParticleTrails ships={ships} />');
  });
});
