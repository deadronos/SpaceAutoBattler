import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Thruster glow enhancement', () => {
  it('has fallback anchor computation logic in Ship.tsx', () => {
    const file = path.resolve(__dirname, '../../src/components/Ship.tsx');
    const txt = fs.readFileSync(file, 'utf-8');
    
    // Check for fallback anchor computation
    expect(txt).toContain('// Fallback: create anchor-based glow meshes if no engines found');
    expect(txt).toContain('anchorsByHull');
    expect(txt).toContain('THRUSTER_GLOW_CONFIG');
    
    // Check for dark emissive detection
    expect(txt).toContain('darkEmissiveThreshold');
    expect(txt).toContain('emissiveLuminance');
    
    // Check for glow mesh creation
    expect(txt).toContain('SphereGeometry');
    expect(txt).toContain('fallbackGlowMeshesRef');
  });

  it('has thruster glow configuration in renderer.ts', () => {
    const file = path.resolve(__dirname, '../../src/config/renderer.ts');
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
    const file = path.resolve(__dirname, '../../src/components/Ship.tsx');
    const txt = fs.readFileSync(file, 'utf-8');
    
    // Check that name-based detection is still first priority
    expect(txt).toContain('nameMatch');
    expect(txt).toContain("n.includes('engine')");
    expect(txt).toContain("n.includes('thruster')");
    expect(txt).toContain("n.includes('exhaust')");
    
    // Check thruster intensity scaling still works
    expect(txt).toContain('thrusterIntensity.base');
    expect(txt).toContain('thrusterIntensity.range');
    expect(txt).toContain('throttle');
  });

  it('has particle trails component integration', () => {
    const file = path.resolve(__dirname, '../../src/components/ParticleTrails.tsx');
    expect(fs.existsSync(file)).toBe(true);
    
    const txt = fs.readFileSync(file, 'utf-8');
    
    // Check for particle system functionality
    expect(txt).toContain('ParticleTrails');
    expect(txt).toContain('InstancedMesh');
    expect(txt).toContain('computeThrusterAnchors');
    expect(txt).toContain('throttle');
    
    // Check it's integrated in Battlefield
    const battlefieldFile = path.resolve(__dirname, '../../src/components/Battlefield.tsx');
    const battlefieldTxt = fs.readFileSync(battlefieldFile, 'utf-8');
    expect(battlefieldTxt).toContain('ParticleTrails');
    expect(battlefieldTxt).toContain('<ParticleTrails ships={ships} />');
  });
});