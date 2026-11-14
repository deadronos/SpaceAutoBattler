import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AxesHelper,
  NeutralToneMapping,
  SRGBColorSpace,
  type ToneMapping,
  type WebGLRenderer,
} from 'three';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { useOptionalGameState } from '../app/context.js';
import { CAMERA_DEFAULTS, FOG_DEFAULTS, WORLD_SIZE } from '../game/config.js';
import { useUiStore } from '../app/uiStore.js';
import { resolveQualitySettings } from '../config/quality.js';
import { POSTPROCESSING_CONFIG, type ColorPipelineConfig } from '../config/renderer.js';
import { usePostprocessingEnabled } from '../hooks/usePostprocessingEnabled.js';
import { BloomProvider } from '../renderer/bloom/index.js';
import PostprocessingLazy from './PostprocessingLazy.js';
import { ParticleTrails } from './ParticleTrails.js';
import { HudOverlayCollector } from './HudOverlayCollector.js';
import { ExplosionsLayer } from './explosions/ExplosionRendererCore.js';
import { PerfMonitorOverlay } from './PerfMonitorOverlay.js';
import DynamicResScaler from './DynamicResScaler.js';
import { CelestialEnvironment } from './environment/CelestialEnvironment.js';
import { BattlefieldSystems } from './BattlefieldSystems.js';
import { CameraRig } from './CameraRig.js';
import { QualityController } from './QualityController.js';
import { ShipsLayer } from './layers/ShipsLayer.js';
import { ProjectilesLayer } from './layers/ProjectilesLayer.js';
import { MuzzleFlashInstancedLayer } from './layers/MuzzleFlashInstancedLayer.js';
import { TurretsLayer } from './layers/TurretsLayer.js';
import { StarsField } from './layers/StarsField.js';
import { WorkerShipsLayer } from './layers/WorkerShipsLayer.js';
import { installWebGLDebugHooks } from '../renderer/webglDebugWrapper.js';
import { configureGltfDecoders } from '../renderer/loaders/gltfDecoders.js';
import { shouldRenderWorkerShips, shouldRenderWorkerShipsOnly } from '../game/SimulationBridge.js';
import { reportWebGLError } from '../utils/errorReporting.js';
import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';

interface BattleSceneContentProps {
  ppEnabled: boolean;
}

function BattleSceneContent({ ppEnabled }: BattleSceneContentProps): React.ReactElement {
  const state = useOptionalGameState();

  if (!state) return <></>;
  const renderWorkerShipsOnly = shouldRenderWorkerShipsOnly();
  const renderWorkerShips = shouldRenderWorkerShips();
  // Expose a local `ships` binding to make particle integration explicit for static checks
  const ships = state.queries.ships;
  // Dev grid/axes are opt-in: only in Copilot debug mode, and still suppressed when
  // `?copilot_hide_planets=1` is present (used by star-disk luminance metrics).
  const showDevGrid =
    isCopilotDebugEnabled() &&
    !(typeof window !== 'undefined' && window.location.search.includes('copilot_hide_planets=1'));

  const sceneContent = (
    <>
      <fog attach="fog" args={FOG_DEFAULTS} />
      <CelestialEnvironment />
      {renderWorkerShips && (
        <Suspense fallback={null}>
          <WorkerShipsLayer />
        </Suspense>
      )}
      {!renderWorkerShipsOnly && (
        <Suspense fallback={null}>
          <ShipsLayer archetype={state.queries.ships} />
        </Suspense>
      )}
      {!renderWorkerShipsOnly && <TurretsLayer archetype={state.queries.turrets} />}
      {!renderWorkerShipsOnly && <MuzzleFlashInstancedLayer archetype={state.queries.turrets} />}
      {!renderWorkerShipsOnly && <ProjectilesLayer archetype={state.queries.projectiles} />}
      {!renderWorkerShipsOnly && <ExplosionsLayer />}
      {!renderWorkerShipsOnly && (
        <Suspense fallback={null}>
          <ParticleTrails ships={ships} />
        </Suspense>
      )}
      {ppEnabled && <PostprocessingLazy />}
      <BattlefieldSystems />
      <HudOverlayCollector />
      <OrbitControls
        enableDamping={
          !(
            typeof window !== 'undefined' &&
            (window.location.search.includes('e2e') ||
              window.location.search.includes('copilot_debug'))
          )
        }
        makeDefault
        target={[0, 0, 0]}
        maxDistance={WORLD_SIZE * 2}
        minDistance={10}
      />
      <CameraRig />
      {showDevGrid && <DevGridAndAxes ppEnabled={ppEnabled} />}
    </>
  );

  return ppEnabled ? <BloomProvider enabled>{sceneContent}</BloomProvider> : sceneContent;
}

/**
 * Opt-in debug overlay: the battlefield grid and world axes.
 * Mounted only when Copilot debug mode is enabled (see `showDevGrid` in
 * `BattleSceneContent`); the `AxesHelper` instance lifecycle is kept here so it is
 * created and disposed only while the overlay is mounted.
 */
function DevGridAndAxes({ ppEnabled }: { ppEnabled: boolean }): React.ReactElement {
  const axesHelper = useMemo(() => new AxesHelper(200), []);
  useEffect(() => () => axesHelper.dispose(), [axesHelper]);

  return (
    <>
      <Grid
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={50}
        sectionSize={500}
        cellColor="#203050"
        sectionColor="#101725"
        position={[0, -5, 0]}
        fadeDistance={ppEnabled ? WORLD_SIZE : undefined}
        transparent
        opacity={ppEnabled ? undefined : 0.1}
      />
      <primitive object={axesHelper} position={[0, 0, 0]} />
    </>
  );
}

/**
 * Main 3D scene component for the battlefield.
 * Sets up the Canvas, lights, camera controls, and renders all game layers (ships, projectiles, etc.).
 *
 * @returns {React.ReactElement} The rendered Battlefield component.
 */
export function Battlefield(): React.ReactElement {
  const state = useOptionalGameState();
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const quality = resolveQualitySettings(qualityPreset, detectedQualityTier);
  const ppEnabled = usePostprocessingEnabled();
  const glRef = useRef<WebGLRenderer | null>(null);

  // Ensure direct-render tone mapping is active whenever postprocessing is
  // inactive (the composer sets NoToneMapping while active and restores on teardown).
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || ppEnabled) return;
    gl.toneMapping = resolveFallbackToneMapping();
    gl.toneMappingExposure = POSTPROCESSING_CONFIG.colorPipeline.exposure;
  }, [ppEnabled]);

  if (!state) {
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas
      shadows
      frameloop="always"
      gl={{ preserveDrawingBuffer: isCopilotDebugEnabled() }}
      camera={{
        position: [...CAMERA_DEFAULTS.position],
        fov: CAMERA_DEFAULTS.fov,
        near: CAMERA_DEFAULTS.near,
        far: CAMERA_DEFAULTS.far,
      }}
      dpr={[quality.dpr.min, quality.dpr.max]}
      onCreated={({ gl }) => {
        const renderer = gl as unknown as WebGLRenderer;
        glRef.current = renderer;
        configureBattlefieldRenderer(renderer);
      }}
      onPointerMissed={() => useUiStore.getState().selectShip(null)}
    >
      <StarsField />
      <QualityController />
      <BattleSceneContent ppEnabled={ppEnabled} />
      <DynamicResScaler
        minDpr={quality.dpr.min}
        maxDpr={quality.dpr.max}
        initialDpr={quality.dpr.initial}
      />
      <PerfMonitorOverlay />
    </Canvas>
  );
}

const FALLBACK_TONE_MAPPINGS: Record<ColorPipelineConfig['toneMapping'], ToneMapping> = {
  agx: AgXToneMapping,
  aces: ACESFilmicToneMapping,
  neutral: NeutralToneMapping,
};

/**
 * Resolve the Three.js tone-mapping mode used when rendering directly without
 * the postprocessing composer.
 */
export function resolveFallbackToneMapping(
  mode: ColorPipelineConfig['toneMapping'] = POSTPROCESSING_CONFIG.colorPipeline.toneMapping,
): ToneMapping {
  return FALLBACK_TONE_MAPPINGS[mode] ?? AgXToneMapping;
}

export function configureBattlefieldRenderer(gl: WebGLRenderer): void {
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = resolveFallbackToneMapping();
  gl.toneMappingExposure = POSTPROCESSING_CONFIG.colorPipeline.exposure;
  try {
    installWebGLDebugHooks(gl);
  } catch (error) {
    reportWebGLError('installWebGLDebugHooks', error);
  }
  // Register self-hosted glTF decoders (Draco/Meshopt/KTX2) once the real renderer exists.
  configureGltfDecoders(gl);
}
