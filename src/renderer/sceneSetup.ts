import * as THREE from 'three';
import type { GameState } from '../types/index.js';
import { RendererEffectsConfig } from '../config/rendererEffectsConfig.js';
import { skyboxVertexShader, skyboxFragmentShader } from './shaders/skyboxShader.js';
import * as logger from '../utils/logger.js';

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
  skyboxShaderMaterial: THREE.ShaderMaterial;
  staticSkyboxTexture: THREE.Texture;
  // Backwards-compatible fields used by older tests
  animatedSkyboxTexture?: THREE.CubeTexture;
  skyboxCanvases?: HTMLCanvasElement[];
  skyboxTextures?: THREE.CanvasTexture[];
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
  
  // Create shader-based animated skybox
  const { skybox, skyboxShaderMaterial, staticSkyboxTexture } = createShaderBasedSkybox();
  scene.add(skybox);
  // Create backwards-compatible cube texture and canvas list used by some tests
  const skyboxCanvases: HTMLCanvasElement[] = [];
  const skyboxTextures: THREE.CanvasTexture[] = [];
  try {
    for (let i = 0; i < 6; i++) {
      const canvas = (staticSkyboxTexture.image as HTMLCanvasElement) || document.createElement('canvas');
      skyboxCanvases.push(canvas);
      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      skyboxTextures.push(tex);
    }
  } catch {
    // ignore - test environments may not support canvas
  }
  const canvases = skyboxCanvases as unknown as HTMLCanvasElement[];
  const animatedCube = new THREE.CubeTexture(canvases);
  animatedCube.needsUpdate = true;
  
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
    skyboxShaderMaterial,
    staticSkyboxTexture,
    animatedSkyboxTexture: animatedCube,
    skyboxCanvases,
    skyboxTextures
  };
}

/**
 * Updates the shader-based animated skybox
 * Now GPU-based instead of CPU texture manipulation
 */
let skyboxAnimationTime = 0;
export function updateSkyboxAnimation(elements: SceneElements, dt: number): void {
  skyboxAnimationTime += dt;
  
  // Update shader uniforms for GPU-based animation
  if (elements.skyboxShaderMaterial && elements.skyboxShaderMaterial.uniforms) {
    elements.skyboxShaderMaterial.uniforms.time.value = skyboxAnimationTime;
  }
}

/**
 * Disposes scene resources
 */
export function disposeScene(elements: SceneElements): void {
  // Dispose textures
  elements.staticSkyboxTexture?.dispose();
  
  // Dispose shader material
  elements.skyboxShaderMaterial?.dispose();
  
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
 * Creates the shader-based animated skybox with GPU-based star twinkling
 * Performance optimization: moves animation from CPU to GPU
 */
function createShaderBasedSkybox(): {
  skybox: THREE.Mesh;
  skyboxShaderMaterial: THREE.ShaderMaterial;
  staticSkyboxTexture: THREE.Texture;
} {
  // Generate static starfield texture (done once, not animated on CPU)
  const staticTexture = generateStaticStarfieldTexture();
  
  // Create shader material with GPU-based animation
  const skyboxShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      twinkleSpeed: { value: RendererEffectsConfig.skybox.starfield.animation.twinkleSpeed },
      starfieldTexture: { value: staticTexture },
      baseColor: { value: new THREE.Vector3(0.0, 0.05, 0.2) } // Deep space blue
    },
    vertexShader: skyboxVertexShader,
    fragmentShader: skyboxFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false
  });

  // Create sphere geometry for skybox
  const skyboxGeometry = new THREE.SphereGeometry(
    RendererEffectsConfig.skybox.sphere.radius,
    RendererEffectsConfig.skybox.sphere.geometrySegments,
    RendererEffectsConfig.skybox.sphere.geometrySegments
  );

  const skybox = new THREE.Mesh(skyboxGeometry, skyboxShaderMaterial);

  return {
    skybox,
    skyboxShaderMaterial,
    staticSkyboxTexture: staticTexture
  };
}

/**
 * Generates a static starfield texture (no animation, just the base pattern)
 */
function generateStaticStarfieldTexture(): THREE.Texture {
  const textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d');

  // Handle test environment where canvas context might not be available
  if (!ctx) {
    logger.warn('Canvas 2D context not available, creating fallback texture');
    // Create a simple colored texture as fallback
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 32;
    fallbackCanvas.height = 32;
    const texture = new THREE.CanvasTexture(fallbackCanvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  // Create gradient background
  const gradient = ctx.createRadialGradient(
    textureSize/2, textureSize/2, 0, 
    textureSize/2, textureSize/2, textureSize/2
  );
  gradient.addColorStop(0, '#001122');
  gradient.addColorStop(0.5, '#000811');
  gradient.addColorStop(1, '#000000');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Generate static stars (no animation)
  const seed = RendererEffectsConfig.skybox.starfield.baseSeed;
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  const starCount = RendererEffectsConfig.skybox.starfield.starCounts.sides;
  const starColors = ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'];

  for (let i = 0; i < starCount; i++) {
    const x = random() * textureSize;
    const y = random() * textureSize;
    const size = random() < 0.7 ? 1 : random() < 0.9 ? 2 : 3;
    const brightness = random();
    const color = starColors[Math.floor(random() * starColors.length)];

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + brightness * 0.7;
    ctx.fillRect(x - size/2, y - size/2, size, size);
  }

  // Add nebula clouds
  if (random() < 0.3) {
    for (let i = 0; i < RendererEffectsConfig.skybox.starfield.nebula.count; i++) {
      const nebulaX = random() * textureSize;
      const nebulaY = random() * textureSize;
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

  ctx.globalAlpha = 1;

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}



/**
 * Default scene manager implementation
 */
export const sceneManager: SceneManager = {
  setupScene,
  updateSkyboxAnimation,
  disposeScene
};