import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AxesHelper, NoToneMapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Suspense, useEffect, useMemo } from 'react';
import type React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { CAMERA_DEFAULTS, FOG_DEFAULTS, WORLD_SIZE } from '../game/config.js';
import { useUiStore } from '../game/uiStore.js';
import { BloomProvider } from '../renderer/bloom/index.js';
import PostprocessingLazy from './PostprocessingLazy.js';
import { ParticleTrails } from './ParticleTrails.js';
import { HudOverlayCollector } from './HudOverlayCollector.js';
import { ExplosionsLayer } from './explosions/ExplosionRendererCore.js';
import { PerfMonitorOverlay } from './PerfMonitorOverlay.js';
import DynamicResScaler from './DynamicResScaler.js';
import { CelestialEnvironment } from './environment/CelestialEnvironment.js';
import { BattlefieldSystems } from './BattlefieldSystems.js';
import { ShipsLayer } from './layers/ShipsLayer.js';
import { ProjectilesLayer } from './layers/ProjectilesLayer.js';
import { MuzzleFlashInstancedLayer } from './layers/MuzzleFlashInstancedLayer.js';
import { TurretsLayer } from './layers/TurretsLayer.js';
import { StarsField } from './layers/StarsField.js';
import { WorkerShipsLayer } from './layers/WorkerShipsLayer.js';
import { installWebGLDebugHooks } from '../renderer/webglDebugWrapper.js';
import { shouldRenderWorkerShips, shouldRenderWorkerShipsOnly } from '../game/SimulationBridge.js';

interface BattleSceneContentProps {
  ppEnabled: boolean;
}

function BattleSceneContent({ ppEnabled }: BattleSceneContentProps): React.ReactElement {
  const state = useOptionalGameState();
  if (!state) return <></>;
  const renderWorkerShipsOnly = shouldRenderWorkerShipsOnly();
  const renderWorkerShips = shouldRenderWorkerShips();
  const axesHelper = useMemo(() => new AxesHelper(200), []);
  useEffect(() => () => axesHelper.dispose(), [axesHelper]);
  // Expose a local `ships` binding to make particle integration explicit for static checks
  const ships = state.queries.ships;

  const sceneContent = (
    <>
      <fog attach="fog" args={FOG_DEFAULTS} />
      <CelestialEnvironment />
      <Suspense fallback={null}>
        {renderWorkerShips && <WorkerShipsLayer />}
        {!renderWorkerShipsOnly && <ShipsLayer archetype={state.queries.ships} />}
        {!renderWorkerShipsOnly && <TurretsLayer archetype={state.queries.turrets} />}
        {!renderWorkerShipsOnly && <MuzzleFlashInstancedLayer archetype={state.queries.turrets} />}
        {!renderWorkerShipsOnly && <ProjectilesLayer archetype={state.queries.projectiles} />}
        {!renderWorkerShipsOnly && <ExplosionsLayer />}
        {!renderWorkerShipsOnly && <ParticleTrails ships={ships} />}
      </Suspense>
      {ppEnabled && <PostprocessingLazy />}
      <BattlefieldSystems />
      <HudOverlayCollector />
      <OrbitControls
        enableDamping
        makeDefault
        target={[0, 0, 0]}
        maxDistance={WORLD_SIZE * 2}
        minDistance={10}
      />
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

  return ppEnabled ? <BloomProvider enabled>{sceneContent}</BloomProvider> : sceneContent;
}

/**
 * Main 3D scene component for the battlefield.
 * Sets up the Canvas, lights, camera controls, and renders all game layers (ships, projectiles, etc.).
 *
 * @returns {React.ReactElement} The rendered Battlefield component.
 */
export function Battlefield(): React.ReactElement {
  const state = useOptionalGameState();
  // Respect UI toggle, but allow a debug override for automation tests so we
  // can force the Postprocessing component to mount even when the UI
  // setting is off. Tests can set `window.__copilot_forcePostprocessingMount = true`.
  const uiPost = useUiStore((s) => s.postprocessingEnabled);
  const ppEnabled =
    typeof window !== 'undefined' && (window as any).__copilot_forcePostprocessingMount === true
      ? true
      : uiPost;

  if (!state) {
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas
      shadows
      frameloop="always"
      camera={{
        position: [...CAMERA_DEFAULTS.position],
        fov: CAMERA_DEFAULTS.fov,
        near: CAMERA_DEFAULTS.near,
        far: CAMERA_DEFAULTS.far,
      }}
      dpr={[0.5, 2]}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = NoToneMapping;
        gl.toneMappingExposure = 1;
        // Install dev-only WebGL debug hooks to capture shader compile/link logs
        // (no-op in production unless ?copilot_debug=1 is present)
        try {
          installWebGLDebugHooks(gl as unknown as WebGLRenderer);
        } catch {
          // ignore debug-install failures
        }
      }}
    >
      <StarsField />
      <BattleSceneContent ppEnabled={ppEnabled} />
      <DynamicResScaler />
      <PerfMonitorOverlay />
    </Canvas>
  );
}
