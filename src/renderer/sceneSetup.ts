import * as THREE from 'three';
import type { GameState } from '../types/index.js';
import { RendererEffectsConfig } from '../config/rendererEffectsConfig.js';
import { RendererConfig } from '../config/rendererConfig.js';

/**
 * Scene setup and lifecycle management
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface SceneElements {
  scene: THREE.Scene;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  boundaryWireframe: THREE.LineSegments;
  skybox: THREE.Mesh;
  animatedSkyboxTexture: THREE.CubeTexture;
  skyboxCanvases: HTMLCanvasElement[];
  skyboxTextures: THREE.CanvasTexture[];
}

export interface SceneManager {
  setupScene(state: GameState): SceneElements;
  updateSkyboxAnimation(elements: SceneElements, dt: number): void;
  disposeScene(elements: SceneElements): void;
}

/**
 * Creates and configures the basic scene elements
 */
export function setupScene(state: GameState): SceneElements {
  const scene = new THREE.Scene();
  
  // Create animated skybox
  const { skybox, animatedSkyboxTexture, skyboxCanvases, skyboxTextures } = createAnimatedSkybox();
  scene.add(skybox);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(
    RendererEffectsConfig.lighting.ambient.color,
    RendererEffectsConfig.lighting.ambient.intensity
  );
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    RendererEffectsConfig.lighting.directional.color,
    RendererEffectsConfig.lighting.directional.intensity
  );
  directionalLight.position.set(
    RendererEffectsConfig.lighting.directional.position.x,
    RendererEffectsConfig.lighting.directional.position.y,
    RendererEffectsConfig.lighting.directional.position.z
  );
  scene.add(directionalLight);

  // Create boundary wireframe
  const boundaryWireframe = createBoundaryWireframe(state);
  scene.add(boundaryWireframe);

  return {
    scene,
    ambientLight,
    directionalLight,
    boundaryWireframe,
    skybox,
    animatedSkyboxTexture,
    skyboxCanvases,
    skyboxTextures
  };
}

/**
 * Updates the animated skybox
 */
let skyboxAnimationTime = 0;
export function updateSkyboxAnimation(elements: SceneElements, dt: number): void {
  skyboxAnimationTime += dt;
  
  if (skyboxAnimationTime > RendererEffectsConfig.skybox.starfield.animation.updateFrequency) {
    skyboxAnimationTime = 0;
    
    elements.skyboxCanvases.forEach((canvas, index) => {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r > 200 && g > 200 && b > 200) {
          const twinkle = Math.sin(skyboxAnimationTime * RendererEffectsConfig.skybox.starfield.animation.twinkleSpeed + i * 0.001) * 0.3 + 0.7;
          data[i] = Math.floor(r * twinkle);
          data[i + 1] = Math.floor(g * twinkle);
          data[i + 2] = Math.floor(b * twinkle);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      elements.skyboxTextures[index].needsUpdate = true;
    });

    if (elements.animatedSkyboxTexture) {
      elements.animatedSkyboxTexture.needsUpdate = true;
    }
  }
}

/**
 * Disposes scene resources
 */
export function disposeScene(elements: SceneElements): void {
  // Dispose textures
  elements.animatedSkyboxTexture?.dispose();
  elements.skyboxTextures?.forEach(texture => texture.dispose());
  
  // Dispose geometries and materials
  elements.boundaryWireframe.geometry?.dispose();
  if (Array.isArray(elements.boundaryWireframe.material)) {
    elements.boundaryWireframe.material.forEach(mat => mat.dispose());
  } else {
    elements.boundaryWireframe.material?.dispose();
  }

  if (elements.skybox.geometry) elements.skybox.geometry.dispose();
  if (elements.skybox.material) {
    if (Array.isArray(elements.skybox.material)) {
      elements.skybox.material.forEach(mat => mat.dispose());
    } else {
      elements.skybox.material.dispose();
    }
  }

  // Clear the scene
  elements.scene.clear();
}

/**
 * Creates the boundary wireframe for the simulation bounds
 */
function createBoundaryWireframe(state: GameState): THREE.LineSegments {
  const boxGeom = new THREE.BoxGeometry(
    state.simConfig.simBounds.width,
    state.simConfig.simBounds.height,
    state.simConfig.simBounds.depth
  );
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lineMat = new THREE.LineBasicMaterial({
    color: RendererEffectsConfig.worldBoundaries.color,
    transparent: true,
    opacity: RendererEffectsConfig.worldBoundaries.opacity
  });
  const boxWire = new THREE.LineSegments(edges, lineMat);
  boxWire.position.set(
    state.simConfig.simBounds.width / 2,
    state.simConfig.simBounds.height / 2,
    state.simConfig.simBounds.depth / 2
  );
  
  boxGeom.dispose(); // Clean up intermediate geometry
  
  return boxWire;
}

/**
 * Creates the animated skybox with procedural starfield
 */
function createAnimatedSkybox(): {
  skybox: THREE.Mesh;
  animatedSkyboxTexture: THREE.CubeTexture;
  skyboxCanvases: HTMLCanvasElement[];
  skyboxTextures: THREE.CanvasTexture[];
} {
  const skyboxCanvases: HTMLCanvasElement[] = [];
  const skyboxTextures: THREE.CanvasTexture[] = [];

  function createAnimatedSkyboxTexture(): THREE.CubeTexture {
    const textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
    const baseSeed = RendererEffectsConfig.skybox.starfield.baseSeed;

    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    
    faces.forEach((face, index) => {
      const canvas = generateStarfieldTexture(textureSize, textureSize, face, baseSeed + index);
      skyboxCanvases.push(canvas);

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      skyboxTextures.push(texture);
    });

    const cubeTexture = new THREE.CubeTexture(skyboxCanvases);
    cubeTexture.generateMipmaps = false;
    cubeTexture.minFilter = THREE.LinearFilter;
    cubeTexture.magFilter = THREE.LinearFilter;
    cubeTexture.needsUpdate = true;

    return cubeTexture;
  }

  function createSphereSkybox(): THREE.Mesh {
    const skyboxGeometry = new THREE.SphereGeometry(
      RendererEffectsConfig.skybox.sphere.radius,
      RendererEffectsConfig.skybox.sphere.geometrySegments,
      RendererEffectsConfig.skybox.sphere.geometrySegments
    );
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      color: '#000033', // Default dark blue space color
      side: THREE.BackSide
    });
    return new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  }

  let sphereSkybox: THREE.Mesh;
  let animatedSkyboxTexture: THREE.CubeTexture;

  try {
    animatedSkyboxTexture = createAnimatedSkyboxTexture();
    sphereSkybox = createSphereSkybox();
    if (sphereSkybox.material && !Array.isArray(sphereSkybox.material)) {
      (sphereSkybox.material as THREE.MeshBasicMaterial).map = animatedSkyboxTexture;
      sphereSkybox.material.needsUpdate = true;
    }
  } catch (e) {
    // Fallback: solid deep blue background if procedural generation fails
    console.warn('Animated skybox generation failed, falling back to solid background', e);
    animatedSkyboxTexture = new THREE.CubeTexture([]);
    sphereSkybox = createSphereSkybox();
  }

  return {
    skybox: sphereSkybox,
    animatedSkyboxTexture,
    skyboxCanvases,
    skyboxTextures
  };
}

/**
 * Generates a starfield texture for skybox faces
 */
function generateStarfieldTexture(width: number, height: number, face: string, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Create gradient background
  const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
  gradient.addColorStop(0, '#001122'); // Dark blue center
  gradient.addColorStop(0.5, '#000811'); // Darker mid
  gradient.addColorStop(1, '#000000'); // Black edge
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Seeded random number generator
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  // Generate stars
  const starCount = face === 'top' || face === 'bottom' ? 
    RendererEffectsConfig.skybox.starfield.starCounts.top : 
    RendererEffectsConfig.skybox.starfield.starCounts.sides;
  const starColors = ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'];

  for (let i = 0; i < starCount; i++) {
    const x = random() * width;
    const y = random() * height;
    const size = random() < 0.7 ? 1 : random() < 0.9 ? 2 : 3;
    const brightness = random();
    const color = starColors[Math.floor(random() * starColors.length)];

    // Reduce star density towards poles for top/bottom faces
    if (face === 'top' || face === 'bottom') {
      const centerDist = Math.abs(y - height/2) / (height/2);
      if (random() < centerDist * 0.5) continue;
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + brightness * 0.7;
    ctx.fillRect(x - size/2, y - size/2, size, size);
  }

  // Add some nebula-like clouds
  if (random() < 0.3) { // 30% probability
    for (let i = 0; i < RendererEffectsConfig.skybox.starfield.nebula.count; i++) {
      const nebulaX = random() * width;
      const nebulaY = random() * height;
      const nebulaRadius = RendererEffectsConfig.skybox.starfield.nebula.minRadius + 
        random() * RendererEffectsConfig.skybox.starfield.nebula.maxRadius;
      
      const nebulaGradient = ctx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, nebulaRadius);
      nebulaGradient.addColorStop(0, `rgba(${100 + random() * 100}, ${50 + random() * 100}, ${150 + random() * 100}, ${0.1 + random() * 0.2})`);
      nebulaGradient.addColorStop(0.5, `rgba(${50 + random() * 100}, ${25 + random() * 75}, ${100 + random() * 100}, ${0.05 + random() * 0.1})`);
      nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = nebulaGradient;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(nebulaX, nebulaY, nebulaRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1; // Reset alpha
  return canvas;
}

/**
 * Default scene manager implementation
 */
export const sceneManager: SceneManager = {
  setupScene,
  updateSkyboxAnimation,
  disposeScene
};