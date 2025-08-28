import { gsap } from 'gsap';
import type { GameState, RendererHandles } from '../types/index.js';
import type { Ship } from '../types/index.js';

export interface AnimationManager {
  initDone: boolean;
  animateCameraTo: (position: { x: number; y: number; z: number }, duration?: number) => Promise<void>;
  animateShipSpawn: (ship: Ship, renderer: RendererHandles) => void;
  animateShipDestruction: (ship: Ship, renderer: RendererHandles) => Promise<void>;
  animateExplosion: (position: { x: number; y: number; z: number }, intensity?: number) => Promise<void>;
  shakeCamera: (intensity: number, duration?: number) => void;
  animateUINumber: (element: HTMLElement, from: number, to: number, duration?: number) => void;
  dispose: () => void;
}

export function createAnimationManager(state: GameState): AnimationManager {
  // GSAP timeline for managing complex animation sequences
  const masterTimeline = gsap.timeline();

  // Camera animation queue to prevent conflicts
  let cameraAnimationInProgress = false;

  function animateCameraTo(targetPosition: { x: number; y: number; z: number }, duration = 2.0): Promise<void> {
    return new Promise((resolve) => {
      if (cameraAnimationInProgress || !state.renderer) {
        resolve();
        return;
      }

      cameraAnimationInProgress = true;

      const startPosition = {
        x: state.renderer.cameraTarget.x,
        y: state.renderer.cameraTarget.y,
        z: state.renderer.cameraTarget.z
      };

      gsap.to(startPosition, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration,
        ease: "power2.inOut",
        onUpdate: () => {
          state.renderer!.cameraTarget.x = startPosition.x;
          state.renderer!.cameraTarget.y = startPosition.y;
          state.renderer!.cameraTarget.z = startPosition.z;
        },
        onComplete: () => {
          cameraAnimationInProgress = false;
          resolve();
        }
      });
    });
  }

  function animateShipSpawn(ship: Ship, renderer: RendererHandles) {
    // Find the ship mesh
    const shipMeshes = (renderer as any).shipMeshes as Map<number, any>;
    const mesh = shipMeshes?.get(ship.id);

    if (!mesh) return;

    // Start small and grow
    gsap.fromTo(mesh.scale,
      { x: 0, y: 0, z: 0 },
      {
        x: 1, y: 1, z: 1,
        duration: 0.8,
        ease: "back.out(1.7)",
        onStart: () => {
          // Add a subtle glow effect
          if (mesh.material && mesh.material.emissive) {
            gsap.fromTo(mesh.material.emissive,
              { r: 0, g: 0, b: 0 },
              { r: 0.2, g: 0.2, b: 0.4, duration: 0.4, yoyo: true, repeat: 1 }
            );
          }
        }
      }
    );
  }

  function animateShipDestruction(ship: Ship, renderer: RendererHandles): Promise<void> {
    return new Promise((resolve) => {
      const shipMeshes = (renderer as any).shipMeshes as Map<number, any>;
      const mesh = shipMeshes?.get(ship.id);

      if (!mesh) {
        resolve();
        return;
      }

      // Create destruction sequence
      const timeline = gsap.timeline({
        onComplete: resolve
      });

      // Flash white
      timeline.to(mesh.material.emissive, {
        r: 1, g: 1, b: 1,
        duration: 0.1
      });

      // Scale up and rotate
      timeline.to(mesh, {
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
        rotationX: Math.PI * 2,
        rotationY: Math.PI * 2,
        duration: 0.3,
        ease: "power2.in"
      }, "<");

      // Fade out and shrink
      timeline.to(mesh, {
        scaleX: 0,
        scaleY: 0,
        scaleZ: 0,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out"
      });

      // Reset emissive
      timeline.to(mesh.material.emissive, {
        r: 0, g: 0, b: 0,
        duration: 0.1
      }, "<");
    });
  }

  function animateExplosion(position: { x: number; y: number; z: number }, intensity = 1.0): Promise<void> {
    return new Promise((resolve) => {
      // Create a temporary explosion sprite or use postprocessing effects
      const effectsManager = (state.renderer as any).effectsManager;
      if (effectsManager && effectsManager.addExplosionEffect) {
        effectsManager.addExplosionEffect(position, intensity);
      }

      // Camera shake
      shakeCamera(intensity * 0.5, 0.3);

      // Resolve after animation completes
      setTimeout(resolve, 500);
    });
  }

  function shakeCamera(intensity: number, duration = 0.5) {
    if (!state.renderer) return;

    const originalPosition = {
      x: state.renderer.cameraTarget.x,
      y: state.renderer.cameraTarget.y,
      z: state.renderer.cameraTarget.z
    };

    gsap.to({}, {
      duration,
      ease: "power2.out",
      onUpdate: function() {
        const progress = this.progress();
        const shake = (1 - progress) * intensity;

        state.renderer!.cameraTarget.x = originalPosition.x + (Math.random() - 0.5) * shake;
        state.renderer!.cameraTarget.y = originalPosition.y + (Math.random() - 0.5) * shake;
        state.renderer!.cameraTarget.z = originalPosition.z + (Math.random() - 0.5) * shake;
      },
      onComplete: () => {
        state.renderer!.cameraTarget.x = originalPosition.x;
        state.renderer!.cameraTarget.y = originalPosition.y;
        state.renderer!.cameraTarget.z = originalPosition.z;
      }
    });
  }

  function animateUINumber(element: HTMLElement, from: number, to: number, duration = 1.0) {
    const obj = { value: from };

    gsap.to(obj, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        element.textContent = Math.round(obj.value).toString();
      }
    });
  }

  return {
    initDone: true,
    animateCameraTo,
    animateShipSpawn,
    animateShipDestruction,
    animateExplosion,
    shakeCamera,
    animateUINumber,
    dispose: () => {
      masterTimeline.kill();
    }
  };
}