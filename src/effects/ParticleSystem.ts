// Particle System for 3D Visual Effects
// Provides reusable particle effects for engines, explosions, bullet hits, etc.

import * as THREE from 'three';

export interface Particle {
  position: any; // THREE.Vector3
  velocity: any; // THREE.Vector3
  life: number;
  maxLife: number;
  size: number;
  color: any; // THREE.Color
  alpha: number;
  userData?: any;
}

export interface ParticleEmitter {
  position: any; // THREE.Vector3
  direction: any; // THREE.Vector3
  spread: number;
  speed: number;
  speedVariance: number;
  life: number;
  lifeVariance: number;
  size: number;
  sizeVariance: number;
  color: any; // THREE.Color
  count: number;
  emitRate: number;
  lastEmit: number;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private emitters: ParticleEmitter[] = [];
  private geometry!: any; // THREE.BufferGeometry
  private material!: any; // THREE.ShaderMaterial
  private points!: any; // THREE.Points
  private positions!: Float32Array;
  private colors!: Float32Array;
  private alphas!: Float32Array;
  private sizes!: Float32Array;
  private maxParticles: number;
  private particleCount: number = 0;

  constructor(maxParticles: number = 10000) {
    this.maxParticles = maxParticles;
    this.initGeometry();
    this.initMaterial();
    this.initPoints();
  }

  private initGeometry(): void {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.alphas = new Float32Array(this.maxParticles);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new (THREE as any).BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new (THREE as any).BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('alpha', new (THREE as any).BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('size', new (THREE as any).BufferAttribute(this.sizes, 1));
  }

  private initMaterial(): void {
    const vertexShader = `
      attribute float alpha;
      attribute float size;
      attribute vec3 color;

      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        vAlpha = alpha;
        vColor = color;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) discard;

        float alpha = vAlpha * (1.0 - r * 2.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    this.material = new (THREE as any).ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: (THREE as any).AdditiveBlending
    });
  }

  private initPoints(): void {
    this.points = new (THREE as any).Points(this.geometry, this.material);
  }

  // Create a new particle emitter
  createEmitter(config: Partial<ParticleEmitter>): number {
    const emitter: ParticleEmitter = {
      position: new (THREE as any).Vector3(),
      direction: new (THREE as any).Vector3(0, 0, 1),
      spread: 0.1,
      speed: 10,
      speedVariance: 0.5,
      life: 1.0,
      lifeVariance: 0.2,
      size: 2.0,
      sizeVariance: 0.5,
      color: new (THREE as any).Color(1, 1, 1),
      count: 10,
      emitRate: 0.1,
      lastEmit: 0,
      active: true,
      ...config
    };

    return this.emitters.push(emitter) - 1;
  }

  // Update emitter position and properties
  updateEmitter(id: number, config: Partial<ParticleEmitter>): void {
    if (this.emitters[id]) {
      Object.assign(this.emitters[id], config);
    }
  }

  // Remove an emitter
  removeEmitter(id: number): void {
    if (this.emitters[id]) {
      this.emitters[id].active = false;
    }
  }

  // Emit particles from an emitter
  emitParticles(emitterId: number, count?: number): void {
    const emitter = this.emitters[emitterId];
    if (!emitter || !emitter.active) return;

    const particleCount = count || emitter.count;

    for (let i = 0; i < particleCount; i++) {
      if (this.particleCount >= this.maxParticles) break;

      const particle: Particle = {
        position: emitter.position.clone(),
        velocity: this.generateVelocity(emitter),
        life: emitter.life * (1 + (Math.random() - 0.5) * emitter.lifeVariance),
        maxLife: emitter.life,
        size: emitter.size * (1 + (Math.random() - 0.5) * emitter.sizeVariance),
        color: emitter.color.clone(),
        alpha: 1.0
      };

      this.particles[this.particleCount] = particle;
      this.particleCount++;
    }
  }

  private generateVelocity(emitter: ParticleEmitter): any {
    // Generate random direction within spread angle
    const spreadAngle = emitter.spread * Math.PI;
    const theta = (Math.random() - 0.5) * spreadAngle;
    const phi = Math.random() * Math.PI * 2;

    const velocity = new (THREE as any).Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(theta),
      Math.cos(phi) * Math.cos(theta)
    );

    // Apply emitter direction
    velocity.applyQuaternion(new (THREE as any).Quaternion().setFromUnitVectors(
      new (THREE as any).Vector3(0, 0, 1),
      emitter.direction
    ));

    // Apply speed
    const speed = emitter.speed * (1 + (Math.random() - 0.5) * emitter.speedVariance);
    velocity.multiplyScalar(speed);

    return velocity;
  }

  // Update particle system
  update(deltaTime: number): void {
    // Update emitters
    for (const emitter of this.emitters) {
      if (!emitter.active) continue;

      emitter.lastEmit += deltaTime;
      if (emitter.lastEmit >= emitter.emitRate) {
        this.emitParticles(this.emitters.indexOf(emitter));
        emitter.lastEmit = 0;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (!particle) continue;

      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

      // Update life
      particle.life -= deltaTime;
      particle.alpha = particle.life / particle.maxLife;

      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        this.particleCount--;
      }
    }

    this.updateGeometry();
  }

  private updateGeometry(): void {
    // Clear arrays
    this.positions.fill(0);
    this.colors.fill(0);
    this.alphas.fill(0);
    this.sizes.fill(0);

    // Update particle data
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle) continue;

      const i3 = i * 3;

      // Position
      this.positions[i3] = particle.position.x;
      this.positions[i3 + 1] = particle.position.y;
      this.positions[i3 + 2] = particle.position.z;

      // Color
      this.colors[i3] = particle.color.r;
      this.colors[i3 + 1] = particle.color.g;
      this.colors[i3 + 2] = particle.color.b;

      // Alpha and size
      this.alphas[i] = particle.alpha;
      this.sizes[i] = particle.size;
    }

    // Mark attributes as needing update
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Update draw count
    this.geometry.setDrawRange(0, this.particles.length);
  }

  // Get the Three.js object for rendering
  getObject3D(): any {
    return this.points;
  }

  // Clear all particles and emitters
  clear(): void {
    this.particles = [];
    this.emitters = [];
    this.particleCount = 0;
  }

  // Get particle count for debugging
  getParticleCount(): number {
    return this.particles.length;
  }

  // Get emitter count for debugging
  getEmitterCount(): number {
    return this.emitters.length;
  }
}

// Predefined effect configurations
export const ParticleEffects = {
  // Engine trail effect
  engineTrail: {
    speed: 5,
    speedVariance: 0.3,
    life: 0.8,
    lifeVariance: 0.2,
    size: 1.5,
    sizeVariance: 0.5,
    color: new (THREE as any).Color(0.3, 0.6, 1.0), // Blue engine glow
    count: 3,
    emitRate: 0.05,
    spread: 0.2
  },

  // Explosion effect
  explosion: {
    speed: 15,
    speedVariance: 0.5,
    life: 1.5,
    lifeVariance: 0.3,
    size: 3.0,
    sizeVariance: 1.0,
    color: new (THREE as any).Color(1.0, 0.5, 0.0), // Orange explosion
    count: 50,
    emitRate: 0.01,
    spread: Math.PI
  },

  // Bullet hit effect
  bulletHit: {
    speed: 8,
    speedVariance: 0.4,
    life: 0.3,
    lifeVariance: 0.1,
    size: 1.0,
    sizeVariance: 0.3,
    color: new (THREE as any).Color(1.0, 1.0, 0.5), // Yellow spark
    count: 8,
    emitRate: 0.01,
    spread: Math.PI * 0.5
  },

  // Shield hit effect
  shieldHit: {
    speed: 12,
    speedVariance: 0.3,
    life: 0.6,
    lifeVariance: 0.2,
    size: 2.0,
    sizeVariance: 0.5,
    color: new (THREE as any).Color(0.2, 0.8, 1.0), // Cyan shield
    count: 15,
    emitRate: 0.01,
    spread: Math.PI * 0.8
  }
};