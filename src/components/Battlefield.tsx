import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AxesHelper, NoToneMapping, SRGBColorSpace } from 'three';
import { Suspense } from 'react';
import type React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { CAMERA_DEFAULTS, FOG_DEFAULTS, WORLD_SIZE } from '../game/config.js';
import { useUiStore } from '../game/uiStore.js';
import { BloomProvider } from '../renderer/BloomProvider.js';
import PostprocessingLazy from './PostprocessingLazy.js';
import { ParticleTrails } from './ParticleTrails.js';
import { HudOverlayCollector } from './HudOverlayCollector.js';
import { ExplosionsLayer } from './ExplosionRenderer.js';
import { PerfMonitorOverlay } from './PerfMonitorOverlay.js';
import { CelestialEnvironment } from './environment/CelestialEnvironment.js';
import { BattlefieldSystems } from './BattlefieldSystems.js';
import { ShipsLayer } from './layers/ShipsLayer.js';
import { ProjectilesLayer } from './layers/ProjectilesLayer.js';
import { TurretsLayer } from './layers/TurretsLayer.js';
import { StarsField } from './layers/StarsField.js';

interface BattleSceneContentProps {
  ppEnabled: boolean;
}

function BattleSceneContent({ ppEnabled }: BattleSceneContentProps): React.ReactElement {
  const state = useOptionalGameState();
  if (!state) return <></>;
  // Expose a local `ships` binding to make particle integration explicit for static checks
  const ships = state.queries.ships;

  const sceneContent = (
    <>
      <fog attach="fog" args={FOG_DEFAULTS} />
      <CelestialEnvironment />
      <Suspense fallback={null}>
        <ShipsLayer archetype={state.queries.ships} />
        <TurretsLayer archetype={state.queries.turrets} />
        <ProjectilesLayer archetype={state.queries.projectiles} />
        <ExplosionsLayer />
        <ParticleTrails ships={ships} />
      </Suspense>
      {ppEnabled && <PostprocessingLazy />}
      <BattlefieldSystems />
      <HudOverlayCollector />
      <OrbitControls enableDamping makeDefault target={[0, 0, 0]} maxDistance={WORLD_SIZE * 2} minDistance={10} />
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
      <primitive object={new AxesHelper(200)} position={[0, 0, 0]} />
    </>
  );

  return ppEnabled ? <BloomProvider enabled>{sceneContent}</BloomProvider> : sceneContent;
}

export function Battlefield(): React.ReactElement {
  const state = useOptionalGameState();
  const ppEnabled = useUiStore((s) => s.postprocessingEnabled);

  if (!state) {
    return <div className="loading-overlay">Preparing simulation…</div>;
  }

  return (
    <Canvas
      shadows
      camera={{ position: [...CAMERA_DEFAULTS.position], fov: CAMERA_DEFAULTS.fov, near: CAMERA_DEFAULTS.near, far: CAMERA_DEFAULTS.far }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = NoToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <StarsField />
      <BattleSceneContent ppEnabled={ppEnabled} />
      <PerfMonitorOverlay />
    </Canvas>
  );
}

