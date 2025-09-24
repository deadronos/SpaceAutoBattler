import { useMemo, useRef, useEffect } from 'react';
import { Color, ShaderMaterial, Texture } from 'three';

interface PlanetRimMaterialProps {
  map?: Texture;
  color?: string;
  emissive?: Color;
  emissiveIntensity?: number;
  rimStrength?: number;
  rimColor?: string;
  metalness?: number;
  roughness?: number;
}

export function PlanetRimMaterial({
  map,
  color = '#ffffff',
  emissive,
  emissiveIntensity = 0.0,
  rimStrength = 0.0,
  rimColor = '#ffffff',
  metalness = 0.0,
  roughness = 1.0
}: PlanetRimMaterialProps): React.ReactElement {
  const materialRef = useRef<ShaderMaterial>(null);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: map || null },
        uColor: { value: new Color(color) },
        uEmissive: { value: emissive || new Color('#000000') },
        uEmissiveIntensity: { value: emissiveIntensity },
        uRimStrength: { value: rimStrength },
        uRimColor: { value: new Color(rimColor) },
        uMetalness: { value: metalness },
        uRoughness: { value: roughness },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform vec3 uEmissive;
        uniform float uEmissiveIntensity;
        uniform float uRimStrength;
        uniform vec3 uRimColor;
        uniform float uMetalness;
        uniform float uRoughness;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        
        void main() {
          // Base color from texture or uniform color
          vec4 texColor = texture2D(uMap, vUv);
          vec3 baseColor = mix(uColor, texColor.rgb, texColor.a);
          
          // Calculate fresnel for rim lighting.
          // Use the absolute value of the view-normal dot so the rim is visible
          // from both above and below the planet (symmetric fresnel).
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float ndv = abs(dot(normal, viewDir));
          float fresnel = 1.0 - ndv;
          fresnel = pow(fresnel, 2.0); // Sharper rim
          
          // Apply rim glow
          vec3 rimGlow = uRimColor * uRimStrength * fresnel;
          
          // Combine base color with emissive and rim
          vec3 emissiveContrib = uEmissive * uEmissiveIntensity;
          vec3 finalColor = baseColor + emissiveContrib + rimGlow;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });
  }, []);

  // Update uniforms when props change
  useEffect(() => {
    if (material) {
      material.uniforms.uMap.value = map || null;
      material.uniforms.uColor.value.set(color);
      material.uniforms.uEmissive.value = emissive || new Color('#000000');
      material.uniforms.uEmissiveIntensity.value = emissiveIntensity;
      material.uniforms.uRimStrength.value = rimStrength;
      material.uniforms.uRimColor.value.set(rimColor);
      material.uniforms.uMetalness.value = metalness;
      material.uniforms.uRoughness.value = roughness;
      material.needsUpdate = true;
    }
  }, [material, map, color, emissive, emissiveIntensity, rimStrength, rimColor, metalness, roughness]);

  return <primitive ref={materialRef} object={material} attach="material" />;
}