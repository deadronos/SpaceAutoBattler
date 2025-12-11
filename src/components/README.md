# components/ - Game Scene Components

React components that render the game scene and visual elements. All components use React Three Fiber for 3D rendering.

## Core Scene Components

| File                       | Purpose                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Battlefield.tsx**        | Main scene container that initializes Canvas, camera, lighting, and orchestrates all scene components |
| **BattlefieldSystems.tsx** | Hooks up game systems (physics stepping, AI, combat) that run every frame                             |
| **Ship.tsx**               | Renders a single ship entity with model, shields, health, and thruster effects                        |
| **Turret.tsx**             | Renders turret on a ship with rotation and muzzle flash effects                                       |

## UI & HUD Components

| File                        | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| **Hud.tsx**                 | Main HUD container; coordinates all heads-up display elements |
| **HudHealthLayer.tsx**      | Renders health bars and damage indicators for ships           |
| **HudOverlayCollector.tsx** | Collects and manages all overlay layers for the HUD           |
| **ShipHudOverlay.tsx**      | Ship-specific HUD information and indicators                  |
| **ProgressionPanel.tsx**    | Displays ship progression and leveling information            |
| **Controls.tsx**            | Manages player input and control scheme                       |
| **hudToggleConfig.ts**      | Configuration for which HUD elements are visible              |
| **HudToggleDrawer.tsx**     | UI drawer for toggling HUD elements on/off                    |

## Effects & Visuals

| File                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| **Explosion.tsx**             | Renders explosion effect at a position using particle system       |
| **ExplosionDebugOverlay.tsx** | Debug overlay for visualizing explosion parameters and behavior    |
| **ParticleTrails.tsx**        | Renders particle trails following moving objects                   |
| **Postprocessing.tsx**        | Sets up post-processing effects pipeline                           |
| **PostprocessingLazy.tsx**    | Lazy-loaded version of postprocessing for performance optimization |

## Debug & Monitoring

| File                       | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| **AiDebugOverlay.tsx**     | Debug overlay showing AI state, intents, and decision-making info |
| **PerfMonitorOverlay.tsx** | Performance monitoring display (FPS, frame time, memory usage)    |
| **progression-panel.css**  | Styling for progression panel                                     |

## Subdirectories

### [environment/](./environment/) - Celestial Environment

Renders the space environment including planets, moons, stars, and atmospheric elements.

### [ship/](./ship/) - Ship Rendering

Specialized components for rendering ship models, shields, and ship-specific effects.

### [explosions/](./explosions/) - Explosion System

Manages explosion rendering with multiple effect types (fireballs, debris, shockwaves, plasma).

### [debris/](./debris/) - Debris Management

Handles debris particle rendering and instancing for performance.

### [thrusters/](./thrusters/) - Thruster Effects

Renders thruster/engine fire effects for ship propulsion.

### [layers/](./layers/) - Rendering Layers

Specialized instanced rendering layers for projectiles, ships, turrets, and muzzle flashes.

### [lod/](./lod/) - Level of Detail

Manages LOD (Level of Detail) switching for distant objects to improve performance.

### [postprocessing/](./postprocessing/) - Post-Processing Effects

Builds post-processing effects chain (bloom, color grading, tone mapping).

## Component Architecture Notes

- All components use React Three Fiber's declarative 3D API
- Components follow ECS pattern via Miniplex entity management
- Instanced rendering used for high entity counts (projectiles, debris)
- Material registry provides cached materials for consistency
- Physics bodies created and managed through Rapier3D integration
