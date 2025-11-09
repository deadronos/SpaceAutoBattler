import { describe, it, expect } from 'vitest';
import {
  createStandardMaterial,
  createBasicMaterial,
  createMaterialFromPreset,
} from '../../src/renderer/materials/materialFactory.js';
import {
  laserPreset,
  plasmaPreset,
  muzzleFlashPreset,
  thrusterGlowPreset,
} from '../../src/renderer/materials/materialPresets.js';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';

describe('materialFactory', () => {
  describe('createStandardMaterial', () => {
    it('creates a MeshStandardMaterial from preset', () => {
      const material = createStandardMaterial(laserPreset);
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material.color.getHexString()).toBe('ffd089');
      expect(material.emissive.getHexString()).toBe('ff962f');
      expect(material.emissiveIntensity).toBe(1.8);
      material.dispose();
    });

    it('creates materials with different presets', () => {
      const material = createStandardMaterial(plasmaPreset);
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material.color.getHexString()).toBe('c78bff');
      expect(material.emissive.getHexString()).toBe('a04bff');
      expect(material.emissiveIntensity).toBe(2.2);
      expect(material.roughness).toBe(0.2);
      expect(material.metalness).toBe(0.1);
      material.dispose();
    });

    it('creates material with blending and transparency', () => {
      const material = createStandardMaterial(muzzleFlashPreset);
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.85);
      expect(material.depthWrite).toBe(false);
      material.dispose();
    });
  });

  describe('createBasicMaterial', () => {
    it('creates a MeshBasicMaterial from preset', () => {
      const material = createBasicMaterial(thrusterGlowPreset);
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material.color.getHexString()).toBe('5fb6ff');
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.85);
      expect(material.depthWrite).toBe(false);
      expect(material.vertexColors).toBe(true);
      material.dispose();
    });
  });

  describe('createMaterialFromPreset', () => {
    it('creates standard material when emissive is present', () => {
      const material = createMaterialFromPreset(laserPreset);
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect((material as MeshStandardMaterial).emissive.getHexString()).toBe('ff962f');
      material.dispose();
    });

    it('creates basic material when standard properties are absent', () => {
      const basicPreset = {
        color: '#ffffff',
        transparent: true,
        opacity: 0.5,
      };
      const material = createMaterialFromPreset(basicPreset);
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material.color.getHexString()).toBe('ffffff');
      material.dispose();
    });

    it('applies overrides to preset', () => {
      const material = createMaterialFromPreset(laserPreset, { emissiveIntensity: 5.0 });
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect((material as MeshStandardMaterial).emissiveIntensity).toBe(5.0);
      expect((material as MeshStandardMaterial).color.getHexString()).toBe('ffd089');
      material.dispose();
    });

    it('creates material from thruster preset with overrides', () => {
      const material = createMaterialFromPreset(thrusterGlowPreset, { opacity: 0.5 });
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material.opacity).toBe(0.5);
      expect(material.color.getHexString()).toBe('5fb6ff');
      material.dispose();
    });
  });

  describe('material preset validation', () => {
    it('validates laser preset properties', () => {
      expect(laserPreset.color).toBe('#ffd089');
      expect(laserPreset.emissive).toBe('#ff962f');
      expect(laserPreset.emissiveIntensity).toBe(1.8);
    });

    it('validates plasma preset properties', () => {
      expect(plasmaPreset.color).toBe('#c78bff');
      expect(plasmaPreset.emissive).toBe('#a04bff');
      expect(plasmaPreset.emissiveIntensity).toBe(2.2);
      expect(plasmaPreset.roughness).toBe(0.2);
      expect(plasmaPreset.metalness).toBe(0.1);
    });

    it('validates muzzle flash preset properties', () => {
      expect(muzzleFlashPreset.color).toBe('#ffd089');
      expect(muzzleFlashPreset.emissive).toBe('#ff962f');
      expect(muzzleFlashPreset.emissiveIntensity).toBe(6.0);
      expect(muzzleFlashPreset.transparent).toBe(true);
      expect(muzzleFlashPreset.opacity).toBe(0.85);
      expect(muzzleFlashPreset.depthWrite).toBe(false);
    });
  });
});
