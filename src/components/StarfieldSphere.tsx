import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useOptionalGameState } from '../game/context.js'; // Match Battlefield

// @ts-ignore - GLSL string, ignore TS parsing errors
const fragmentShader = `
// Star Nest (MIT) adapted. Restored original attenuation model to avoid white wash.
precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform float uZoom; uniform float uTile; uniform float uSpeed;
uniform float uBrightness; uniform float uDarkmatter; uniform float uDistfading; uniform float uSaturation;
uniform float uFinalScale; uniform float uBaseContribution; // new controls
uniform int uIterations; uniform int uVolsteps; uniform float uStepsize; uniform float uFormuparam;
#define MAX_ITER 20
#define MAX_VOL 32
void main(){
  vec2 uv = gl_FragCoord.xy / uResolution.xy - 0.5; uv.y *= uResolution.y / uResolution.x;
  vec3 dir = vec3(uv * uZoom, 1.0);
  float time = uTime * uSpeed + 0.25;
  float a1 = 0.5; float a2 = 0.8; // fixed rotations (could be uniforms)
  mat2 r1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
  mat2 r2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
  dir.xz *= r1; dir.xy *= r2;
  vec3 from = vec3(1.0,0.5,0.5) + vec3(time*2.0, time, -2.0);
  from.xz *= r1; from.xy *= r2;
  float s=0.1; float fade=1.0; vec3 v=vec3(0.0);
  for(int rs=0; rs<MAX_VOL; ++rs){ if(rs>=uVolsteps) break; vec3 p = from + s*dir*0.5; p = abs(vec3(uTile)-mod(p, vec3(uTile*2.0)));
    float pa=0.0; float acc=0.0; for(int i=0;i<MAX_ITER;++i){ if(i>=uIterations) break; p = abs(p)/dot(p,p)-uFormuparam; float pl=length(p); acc += abs(pl-pa); pa=pl; }
    float dm = max(0.0, uDarkmatter - acc*acc*0.001); acc *= acc*acc; if(rs>6) fade *= 1.0 - dm; 
    // Optional base fog-like accumulation scaled down heavily
    v += fade * uBaseContribution; 
    // Distance-based coloring similar to original
    v += vec3(s, s*s, s*s*s*s) * acc * uBrightness * fade; 
    fade *= uDistfading; s += uStepsize; }
  v = mix(vec3(length(v)), v, uSaturation);
  gl_FragColor = vec4(v * uFinalScale, 1.0);
}`;

interface StarfieldProps {
  enabled?: boolean;
  quality?: 'high' | 'medium' | 'low';
  updateFrequency?: number;
  shaderResolution?: number;
  radius?: number;
  config?: {
    zoom: number;
    tile: number;
    speed: number;
    brightness: number;
    darkmatter: number;
    distfading: number;
    saturation: number;
  };
}

const StarfieldSphere: React.FC<StarfieldProps> = ({
  enabled = true,
  quality = 'medium',
  updateFrequency = 1,
  shaderResolution = 1024,
  radius = 50000, // Large enclosing sphere; camera far plane must exceed this
  config = {
    zoom: 0.800,
    tile: 0.850,
    speed: 0.010,
  brightness: 0.0015, // Original baseline brightness
    darkmatter: 0.300,
    distfading: 0.730,
    saturation: 0.850,
  },
}) => {
  const { gl, clock } = useThree();
  const gameState = useOptionalGameState(); // Top-level hook call
  const gameStateRef = useRef(gameState);
  const simTimeRef = useRef(0);
  const sphereRef = useRef<THREE.Mesh>(null);
  const renderTargetRef = useRef<THREE.WebGLRenderTarget>(null);
  const shaderSceneRef = useRef<THREE.Scene>(null);
  const shaderCameraRef = useRef<THREE.OrthographicCamera>(null);
  const shaderQuadRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const sphereMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const frameCountRef = useRef(0);

  const getQualitySettings = useMemo(() => {
    switch (quality) {
      case 'high':
        return { iterations: 17, volsteps: 20, stepsize: 0.1 };
      case 'medium':
        return { iterations: 9, volsteps: 10, stepsize: 0.15 };
      case 'low':
        return { iterations: 5, volsteps: 5, stepsize: 0.2 };
      default:
        return { iterations: 9, volsteps: 10, stepsize: 0.15 };
    }
  }, [quality]);

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(radius, 64, 32), [radius]);

  // Create render target
  const renderTarget = useMemo(() => {
    const rtHeight = Math.floor(shaderResolution / 2);
    return new THREE.WebGLRenderTarget(shaderResolution, rtHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
  }, [shaderResolution]);

  useEffect(() => {
    if (!enabled) return;

    renderTargetRef.current = renderTarget;

    // Shader scene
    const shaderScene = new THREE.Scene();
    shaderSceneRef.current = shaderScene;

    // Orthographic camera
    const aspect = 2;
    const shaderCamera = new THREE.OrthographicCamera(-1, 1, 1 / aspect, -1 / aspect, 0.1, 1000);
    shaderCamera.position.z = 1;
    shaderCameraRef.current = shaderCamera;

    // Quad geometry
    const quadGeometry = new THREE.PlaneGeometry(2, 1);

    // Shader material
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(shaderResolution, shaderResolution / 2) },
        uTime: { value: 0 },
        uZoom: { value: config.zoom },
        uTile: { value: config.tile },
        uSpeed: { value: config.speed },
        uBrightness: { value: config.brightness },
        uDarkmatter: { value: config.darkmatter },
        uDistfading: { value: config.distfading },
  uSaturation: { value: config.saturation },
  uFinalScale: { value: (config as any).finalScale ?? 0.01 },
  uBaseContribution: { value: (config as any).baseContribution ?? 0.0 },
        uIterations: { value: getQualitySettings.iterations },
        uVolsteps: { value: getQualitySettings.volsteps },
        uStepsize: { value: getQualitySettings.stepsize },
        uFormuparam: { value: 0.53 },
      },
      fragmentShader,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
    });
    materialRef.current = shaderMaterial;

    const quad = new THREE.Mesh(quadGeometry, shaderMaterial);
    shaderQuadRef.current = quad;
    shaderScene.add(quad);

    // Sphere material
    const sphereMaterial = new THREE.MeshBasicMaterial({
      map: renderTarget.texture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      fog: false,
    });
    sphereMaterialRef.current = sphereMaterial;
    if (sphereRef.current) {
      sphereRef.current.material = sphereMaterial;
    }

  // console.debug('Starfield: sphere added radius', radius);

    return () => {
      // Cleanup
      shaderMaterial.dispose();
      quadGeometry.dispose();
      sphereMaterial.dispose();
      renderTarget.dispose();
      if (shaderSceneRef.current) {
        shaderSceneRef.current.clear();
      }
    };
  }, [enabled, quality, shaderResolution, radius, config, renderTarget, getQualitySettings, fragmentShader]);

  useEffect(() => {
    gameStateRef.current = gameState; // Update ref if context changes
  // console.debug('Starfield: GameState context present?', !!gameState);
  }, [gameState]);

  useFrame(() => {
    if (!enabled) return;
    // Update time from ref
    if (gameStateRef.current) {
      simTimeRef.current = gameStateRef.current.time;
    } else {
      simTimeRef.current = clock.getElapsedTime(); // Fallback
    }

    frameCountRef.current++;
    if (frameCountRef.current % updateFrequency !== 0) return;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = simTimeRef.current * config.speed + 0.25;
    }

    // Render to target
    if (renderTargetRef.current && shaderSceneRef.current && shaderCameraRef.current) {
      gl.setRenderTarget(renderTargetRef.current);
      gl.render(shaderSceneRef.current, shaderCameraRef.current);
      gl.setRenderTarget(null);
      if (sphereMaterialRef.current) {
        sphereMaterialRef.current.needsUpdate = true;
      }
    }

  // console.debug('Starfield frame', frameCountRef.current, simTimeRef.current);
  });

  if (!enabled) return null;

  return (
    <mesh ref={sphereRef} geometry={sphereGeometry} position={[0, 0, 0]}>
      <meshBasicMaterial 
        ref={sphereMaterialRef}
        map={renderTarget.texture}
        side={THREE.BackSide as any}
        transparent
        opacity={1.0}
      />
    </mesh>
  );
};

export default StarfieldSphere;
