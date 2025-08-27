/**
 * GPU Particle Systems using Transform Feedback
 * Hardware-accelerated particles for explosions, engine trails, and weapon effects
 */
/**
 * GPU Particle System Manager
 */
export class GPUParticleSystemManager {
    gl;
    particleSystems = new Map();
    globalUniforms;
    constructor(gl) {
        this.gl = gl;
        this.globalUniforms = {
            deltaTime: 0.016, // 60 FPS default
            currentTime: 0,
            gravity: new Float32Array([0, -9.81, 0]),
            wind: new Float32Array([0, 0, 0])
        };
    }
    /**
     * Create particle system with specified configuration
     */
    createParticleSystem(name, config) {
        const gl = this.gl;
        // Create particle buffers
        const buffers = this.createParticleBuffers(config.maxParticles);
        // Create simulation program
        const simulationProgram = this.createSimulationProgram();
        // Create render program
        const renderProgram = this.createRenderProgram(config.blendMode);
        // Create transform feedback
        const transformFeedback = gl.createTransformFeedback();
        if (!transformFeedback) {
            throw new Error('Failed to create transform feedback');
        }
        // Create render VAO
        const renderVAO = this.createRenderVAO(buffers);
        const particleSystem = {
            name,
            config,
            buffers,
            simulationProgram,
            renderProgram,
            transformFeedback,
            renderVAO,
            activeParticles: 0,
            lastEmissionTime: 0,
            enabled: true
        };
        this.particleSystems.set(name, particleSystem);
        return particleSystem;
    }
    /**
     * Create particle buffers with ping-pong setup
     */
    createParticleBuffers(maxParticles) {
        const gl = this.gl;
        // Calculate buffer sizes
        const positionSize = maxParticles * 4 * 4; // vec4 * 4 bytes
        const velocitySize = maxParticles * 4 * 4; // vec4 * 4 bytes
        const colorSize = maxParticles * 4 * 4; // vec4 * 4 bytes
        const sizeRotationSize = maxParticles * 4 * 4; // vec4 * 4 bytes
        // Create ping-pong buffers
        const positionBuffers = [
            this.createBuffer(positionSize),
            this.createBuffer(positionSize)
        ];
        const velocityBuffers = [
            this.createBuffer(velocitySize),
            this.createBuffer(velocitySize)
        ];
        const colorBuffers = [
            this.createBuffer(colorSize),
            this.createBuffer(colorSize)
        ];
        const sizeRotationBuffers = [
            this.createBuffer(sizeRotationSize),
            this.createBuffer(sizeRotationSize)
        ];
        return {
            positionBuffers,
            velocityBuffers,
            colorBuffers,
            sizeRotationBuffers,
            currentBuffer: 0,
            bufferSize: maxParticles
        };
    }
    /**
     * Create a WebGL buffer
     */
    createBuffer(size) {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new Error('Failed to create buffer');
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
        return buffer;
    }
    /**
     * Create simulation shader program
     */
    createSimulationProgram() {
        const gl = this.gl;
        const vertexSource = `#version 300 es
      precision highp float;
      
      // Input attributes (current state)
      in vec4 a_position;    // x, y, z, w
      in vec4 a_velocity;    // vx, vy, vz, vw
      in vec4 a_color;       // r, g, b, a
      in vec4 a_sizeRotation; // size, rotation, age, lifespan
      
      // Uniforms
      uniform float u_deltaTime;
      uniform float u_currentTime;
      uniform vec3 u_gravity;
      uniform vec3 u_wind;
      uniform float u_damping;
      
      // Transform feedback outputs (next state)
      out vec4 v_position;
      out vec4 v_velocity;
      out vec4 v_color;
      out vec4 v_sizeRotation;
      
      // Random number generation
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      void main() {
        vec3 position = a_position.xyz;
        vec3 velocity = a_velocity.xyz;
        vec4 color = a_color;
        float size = a_sizeRotation.x;
        float rotation = a_sizeRotation.y;
        float age = a_sizeRotation.z;
        float lifespan = a_sizeRotation.w;
        
        // Update age
        age += u_deltaTime;
        
        // Check if particle is alive
        if (age > lifespan) {
          // Particle is dead, reset or disable
          v_position = vec4(0.0, 0.0, 0.0, -1.0); // w = -1 means dead
          v_velocity = vec4(0.0);
          v_color = vec4(0.0);
          v_sizeRotation = vec4(0.0, 0.0, lifespan + 1.0, lifespan); // age > lifespan
        } else {
          // Particle is alive, update
          
          // Apply forces
          vec3 acceleration = u_gravity + u_wind;
          
          // Add some turbulence
          vec2 noiseCoord = position.xy * 0.1 + u_currentTime * 0.1;
          float turbulenceX = (random(noiseCoord) - 0.5) * 2.0;
          float turbulenceY = (random(noiseCoord + vec2(1.0, 0.0)) - 0.5) * 2.0;
          float turbulenceZ = (random(noiseCoord + vec2(0.0, 1.0)) - 0.5) * 2.0;
          
          acceleration += vec3(turbulenceX, turbulenceY, turbulenceZ) * 0.5;
          
          // Update velocity with damping
          velocity = velocity * (1.0 - u_damping * u_deltaTime) + acceleration * u_deltaTime;
          
          // Update position
          position += velocity * u_deltaTime;
          
          // Update rotation
          rotation += length(velocity) * u_deltaTime * 0.1;
          
          // Fade color over lifetime
          float lifeFactor = age / lifespan;
          color.a = mix(1.0, 0.0, lifeFactor * lifeFactor); // Quadratic fade
          
          // Size variation over lifetime
          float sizeScale = 1.0 - lifeFactor * 0.5; // Shrink to 50% over lifetime
          size *= sizeScale;
          
          // Output updated state
          v_position = vec4(position, 1.0); // w = 1 means alive
          v_velocity = vec4(velocity, 0.0);
          v_color = color;
          v_sizeRotation = vec4(size, rotation, age, lifespan);
        }
        
        // Required for vertex shader (not used for rendering)
        gl_Position = vec4(0.0);
      }
    `;
        const fragmentSource = `#version 300 es
      precision highp float;
      
      out vec4 fragColor;
      
      void main() {
        // Fragment shader not used for simulation (rasterizer disabled)
        discard;
      }
    `;
        return this.createShaderProgram(vertexSource, fragmentSource, ['v_position', 'v_velocity', 'v_color', 'v_sizeRotation']);
    }
    /**
     * Create render shader program
     */
    createRenderProgram(blendMode) {
        const gl = this.gl;
        const vertexSource = `#version 300 es
      precision highp float;
      
      // Instanced attributes
      in vec4 a_position;     // particle position (w = alive flag)
      in vec4 a_color;        // particle color
      in vec4 a_sizeRotation; // size, rotation, age, lifespan
      
      // Quad vertex attributes
      in vec2 a_quadVertex;   // [-1,-1] to [1,1] quad
      
      uniform mat4 u_viewProjectionMatrix;
      uniform vec3 u_cameraRight;
      uniform vec3 u_cameraUp;
      
      out vec2 v_uv;
      out vec4 v_color;
      
      void main() {
        // Skip dead particles
        if (a_position.w <= 0.0) {
          gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
          return;
        }
        
        vec3 particlePos = a_position.xyz;
        float size = a_sizeRotation.x;
        float rotation = a_sizeRotation.y;
        
        // Create billboard quad
        vec2 quadPos = a_quadVertex;
        
        // Apply rotation
        float c = cos(rotation);
        float s = sin(rotation);
        mat2 rotMatrix = mat2(c, -s, s, c);
        quadPos = rotMatrix * quadPos;
        
        // Scale by particle size
        quadPos *= size;
        
        // Billboard positioning
        vec3 worldPos = particlePos + 
                       quadPos.x * u_cameraRight + 
                       quadPos.y * u_cameraUp;
        
        gl_Position = u_viewProjectionMatrix * vec4(worldPos, 1.0);
        
        // UV coordinates for texture sampling
        v_uv = a_quadVertex * 0.5 + 0.5;
        v_color = a_color;
      }
    `;
        const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec2 v_uv;
      in vec4 v_color;
      
      uniform sampler2D u_texture;
      
      out vec4 fragColor;
      
      void main() {
        vec4 texColor = texture(u_texture, v_uv);
        
        // Apply particle color
        fragColor = texColor * v_color;
        
        // Alpha test for better performance
        if (fragColor.a < 0.01) {
          discard;
        }
      }
    `;
        return this.createShaderProgram(vertexSource, fragmentSource, []);
    }
    /**
     * Create render VAO for particles
     */
    createRenderVAO(buffers) {
        const gl = this.gl;
        const vao = gl.createVertexArray();
        if (!vao) {
            throw new Error('Failed to create VAO');
        }
        gl.bindVertexArray(vao);
        // Create quad vertex buffer (shared for all particles)
        const quadVertices = new Float32Array([
            -1, -1, // bottom-left
            1, -1, // bottom-right
            -1, 1, // top-left
            1, 1 // top-right
        ]);
        const quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
        // Quad vertex attribute (location 4)
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);
        // Create index buffer for quad
        const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return vao;
    }
    /**
     * Bind particle buffers to VAO for rendering
     */
    bindParticleBuffersToVAO(vao, buffers) {
        const gl = this.gl;
        const currentIdx = buffers.currentBuffer;
        gl.bindVertexArray(vao);
        // Position buffer (location 0, instanced)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffers[currentIdx]);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 1); // One per instance
        // Color buffer (location 1, instanced)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffers[currentIdx]);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(1, 1);
        // Size/rotation buffer (location 2, instanced)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sizeRotationBuffers[currentIdx]);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);
    }
    /**
     * Update particle system simulation
     */
    updateParticleSystem(name, deltaTime, currentTime, emitterPosition) {
        const system = this.particleSystems.get(name);
        if (!system || !system.enabled) {
            return false;
        }
        const gl = this.gl;
        // Update global uniforms
        this.globalUniforms.deltaTime = deltaTime;
        this.globalUniforms.currentTime = currentTime;
        // Update emitter position if provided
        if (emitterPosition) {
            system.config.position = emitterPosition;
        }
        // Emit new particles
        this.emitParticles(system, currentTime);
        // Set up simulation
        gl.useProgram(system.simulationProgram);
        // Set uniforms
        const uniformLocations = this.getUniformLocations(system.simulationProgram, [
            'u_deltaTime', 'u_currentTime', 'u_gravity', 'u_wind', 'u_damping'
        ]);
        gl.uniform1f(uniformLocations.get('u_deltaTime'), deltaTime);
        gl.uniform1f(uniformLocations.get('u_currentTime'), currentTime);
        gl.uniform3fv(uniformLocations.get('u_gravity'), this.globalUniforms.gravity);
        gl.uniform3fv(uniformLocations.get('u_wind'), this.globalUniforms.wind);
        gl.uniform1f(uniformLocations.get('u_damping'), system.config.damping);
        // Set up transform feedback
        const buffers = system.buffers;
        const currentIdx = buffers.currentBuffer;
        const nextIdx = 1 - currentIdx;
        // Bind input buffers (current frame)
        const inputVAO = gl.createVertexArray();
        gl.bindVertexArray(inputVAO);
        // Position input (location 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffers[currentIdx]);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
        // Velocity input (location 1)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.velocityBuffers[currentIdx]);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        // Color input (location 2)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffers[currentIdx]);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        // Size/rotation input (location 3)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sizeRotationBuffers[currentIdx]);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        // Set up transform feedback outputs (next frame)
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, system.transformFeedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffers.positionBuffers[nextIdx]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, buffers.velocityBuffers[nextIdx]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, buffers.colorBuffers[nextIdx]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, buffers.sizeRotationBuffers[nextIdx]);
        // Disable rasterization
        gl.enable(gl.RASTERIZER_DISCARD);
        // Begin transform feedback
        gl.beginTransformFeedback(gl.POINTS);
        // Draw particles (triggers simulation)
        gl.drawArrays(gl.POINTS, 0, buffers.bufferSize);
        // End transform feedback
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        // Clean up
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);
        gl.deleteVertexArray(inputVAO);
        // Swap buffers
        buffers.currentBuffer = nextIdx;
        return true;
    }
    /**
     * Emit new particles
     */
    emitParticles(system, currentTime) {
        const config = system.config;
        const timeSinceLastEmission = currentTime - system.lastEmissionTime;
        const particlesToEmit = Math.floor(config.emissionRate * timeSinceLastEmission);
        if (particlesToEmit > 0) {
            // TODO: Implement particle emission by updating buffer data
            // This would involve finding dead particles and reinitializing them
            system.lastEmissionTime = currentTime;
        }
    }
    /**
     * Render particle system
     */
    renderParticleSystem(name, viewProjectionMatrix, cameraRight, cameraUp) {
        const system = this.particleSystems.get(name);
        if (!system || !system.enabled) {
            return false;
        }
        const gl = this.gl;
        // Set blend mode
        this.setBlendMode(system.config.blendMode);
        // Use render program
        gl.useProgram(system.renderProgram);
        // Set uniforms
        const uniformLocations = this.getUniformLocations(system.renderProgram, [
            'u_viewProjectionMatrix', 'u_cameraRight', 'u_cameraUp', 'u_texture'
        ]);
        gl.uniformMatrix4fv(uniformLocations.get('u_viewProjectionMatrix'), false, viewProjectionMatrix);
        gl.uniform3fv(uniformLocations.get('u_cameraRight'), cameraRight);
        gl.uniform3fv(uniformLocations.get('u_cameraUp'), cameraUp);
        // Bind texture
        if (system.config.texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, system.config.texture);
            gl.uniform1i(uniformLocations.get('u_texture'), 0);
        }
        // Bind particle buffers to VAO
        this.bindParticleBuffersToVAO(system.renderVAO, system.buffers);
        // Render particles
        gl.bindVertexArray(system.renderVAO);
        gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, system.buffers.bufferSize);
        gl.bindVertexArray(null);
        return true;
    }
    /**
     * Set blend mode for particle rendering
     */
    setBlendMode(blendMode) {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        switch (blendMode) {
            case 'additive':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
            case 'alpha':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            default:
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
    /**
     * Create explosion particle system
     */
    createExplosion(name, position, config = {}) {
        const explosionConfig = {
            maxParticles: config.maxParticles || 1000,
            emissionRate: config.emissionRate || 2000, // Burst emission
            position,
            velocityRange: {
                min: [-20, -20, -20],
                max: [20, 20, 20]
            },
            sizeRange: { min: 0.1, max: 2.0 },
            lifespanRange: { min: 0.5, max: 3.0 },
            colorStart: [1, 0.8, 0, 1], // Orange
            colorEnd: [0.8, 0.1, 0, 0], // Dark red, transparent
            gravity: [0, -5, 0],
            damping: 0.98,
            blendMode: 'additive',
            ...config
        };
        return this.createParticleSystem(name, explosionConfig);
    }
    /**
     * Create engine trail particle system
     */
    createEngineTrail(name, position, thrustDirection, config = {}) {
        const trailConfig = {
            maxParticles: config.maxParticles || 500,
            emissionRate: config.emissionRate || 100,
            position,
            velocityRange: {
                min: [thrustDirection[0] * -5, thrustDirection[1] * -5, thrustDirection[2] * -5],
                max: [thrustDirection[0] * -2, thrustDirection[1] * -2, thrustDirection[2] * -2]
            },
            sizeRange: { min: 0.05, max: 0.5 },
            lifespanRange: { min: 0.2, max: 1.5 },
            colorStart: [0, 0.5, 1, 1], // Blue
            colorEnd: [0, 0.2, 0.8, 0], // Dark blue, transparent
            gravity: [0, 0, 0],
            damping: 0.95,
            blendMode: 'additive',
            ...config
        };
        return this.createParticleSystem(name, trailConfig);
    }
    /**
     * Create shader program with transform feedback
     */
    createShaderProgram(vertexSource, fragmentSource, varyings) {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        if (!program) {
            throw new Error('Failed to create shader program');
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        // Set transform feedback varyings (only for simulation program)
        if (varyings.length > 0) {
            gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Failed to link program: ${error}`);
        }
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return program;
    }
    /**
     * Compile shader
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error('Failed to create shader');
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${error}`);
        }
        return shader;
    }
    /**
     * Get uniform locations
     */
    getUniformLocations(program, uniformNames) {
        const gl = this.gl;
        const uniforms = new Map();
        for (const name of uniformNames) {
            const location = gl.getUniformLocation(program, name);
            if (location) {
                uniforms.set(name, location);
            }
        }
        return uniforms;
    }
    /**
     * Set global gravity
     */
    setGravity(gravity) {
        this.globalUniforms.gravity.set(gravity);
    }
    /**
     * Set global wind
     */
    setWind(wind) {
        this.globalUniforms.wind.set(wind);
    }
    /**
     * Get particle system by name
     */
    getParticleSystem(name) {
        return this.particleSystems.get(name);
    }
    /**
     * Enable/disable particle system
     */
    setParticleSystemEnabled(name, enabled) {
        const system = this.particleSystems.get(name);
        if (system) {
            system.enabled = enabled;
            return true;
        }
        return false;
    }
    /**
     * Update all particle systems
     */
    updateAll(deltaTime, currentTime) {
        for (const [name, system] of this.particleSystems) {
            if (system.enabled) {
                this.updateParticleSystem(name, deltaTime, currentTime);
            }
        }
    }
    /**
     * Render all particle systems
     */
    renderAll(viewProjectionMatrix, cameraRight, cameraUp) {
        // Disable depth writing for particles (but keep depth testing)
        const gl = this.gl;
        gl.depthMask(false);
        for (const [name, system] of this.particleSystems) {
            if (system.enabled) {
                this.renderParticleSystem(name, viewProjectionMatrix, cameraRight, cameraUp);
            }
        }
        // Re-enable depth writing
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
    /**
     * Dispose of all resources
     */
    dispose() {
        const gl = this.gl;
        for (const [name, system] of this.particleSystems) {
            // Delete buffers
            for (const buffer of system.buffers.positionBuffers) {
                gl.deleteBuffer(buffer);
            }
            for (const buffer of system.buffers.velocityBuffers) {
                gl.deleteBuffer(buffer);
            }
            for (const buffer of system.buffers.colorBuffers) {
                gl.deleteBuffer(buffer);
            }
            for (const buffer of system.buffers.sizeRotationBuffers) {
                gl.deleteBuffer(buffer);
            }
            // Delete programs
            gl.deleteProgram(system.simulationProgram);
            gl.deleteProgram(system.renderProgram);
            // Delete transform feedback
            gl.deleteTransformFeedback(system.transformFeedback);
            // Delete VAO
            gl.deleteVertexArray(system.renderVAO);
        }
        this.particleSystems.clear();
    }
}
