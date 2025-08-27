/**
 * Multiple Render Targets (MRT) and Deferred Rendering Support
 * Enables advanced lighting, post-processing, and screen-space techniques
 */

export interface RenderTarget {
  /** Framebuffer object */
  framebuffer: WebGLFramebuffer;
  /** Color attachments */
  colorTextures: WebGLTexture[];
  /** Depth texture (optional) */
  depthTexture?: WebGLTexture;
  /** Stencil texture (optional) */
  stencilTexture?: WebGLTexture;
  /** Render target width */
  width: number;
  /** Render target height */
  height: number;
  /** Number of samples for MSAA (0 = no MSAA) */
  samples: number;
  /** Color formats for each attachment */
  colorFormats: number[];
  /** Depth format */
  depthFormat?: number;
}

export interface GBuffer extends RenderTarget {
  /** Albedo + metallic (RGB + A) */
  albedoMetallic: WebGLTexture;
  /** Normal + roughness (RGB + A) */
  normalRoughness: WebGLTexture;
  /** Position + ao (RGB + A) */
  positionAO: WebGLTexture;
  /** Motion vectors + depth (RG + B + A) */
  motionDepth: WebGLTexture;
  /** Emission + flags (RGB + A) */
  emissionFlags: WebGLTexture;
}

export interface PostProcessTarget extends RenderTarget {
  /** HDR color buffer */
  hdrColor: WebGLTexture;
  /** Brightness buffer for bloom */
  brightColor?: WebGLTexture;
  /** Velocity buffer for motion blur */
  velocity?: WebGLTexture;
}

export interface DeferredRenderingConfig {
  /** Enable G-buffer rendering */
  enableGBuffer: boolean;
  /** Number of color attachments */
  colorAttachments: number;
  /** Use depth texture */
  useDepthTexture: boolean;
  /** Enable MSAA */
  enableMSAA: boolean;
  /** MSAA sample count */
  msaaSamples: number;
  /** Enable HDR rendering */
  enableHDR: boolean;
  /** Internal format for color buffers */
  colorFormat: number;
  /** Internal format for depth buffer */
  depthFormat: number;
}

export interface ScreenSpaceEffect {
  /** Effect name */
  name: string;
  /** Shader program */
  program: WebGLProgram;
  /** Input textures */
  inputs: string[];
  /** Output target */
  output: string;
  /** Uniforms */
  uniforms: Map<string, WebGLUniformLocation>;
  /** Enabled state */
  enabled: boolean;
}

/**
 * Multiple Render Targets Manager for Deferred Rendering
 */
export class DeferredRenderer {
  private gl: WebGL2RenderingContext;
  private config: DeferredRenderingConfig;
  private renderTargets = new Map<string, RenderTarget>();
  private gBuffer?: GBuffer;
  private postProcessTargets: PostProcessTarget[] = [];
  private screenSpaceEffects: ScreenSpaceEffect[] = [];
  private fullscreenQuadVAO?: WebGLVertexArrayObject;
  private maxColorAttachments: number;
  private maxDrawBuffers: number;
  
  constructor(gl: WebGL2RenderingContext, config: DeferredRenderingConfig) {
    this.gl = gl;
    this.config = config;
    
    // Query WebGL limits
    this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
    this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
    
    this.validateConfig();
    this.createFullscreenQuad();
  }
  
  /**
   * Validate deferred rendering configuration
   */
  private validateConfig(): void {
    const gl = this.gl;
    
    if (this.config.colorAttachments > this.maxColorAttachments) {
      console.warn(`Requested ${this.config.colorAttachments} color attachments, but only ${this.maxColorAttachments} supported`);
      this.config.colorAttachments = this.maxColorAttachments;
    }
    
    if (this.config.colorAttachments > this.maxDrawBuffers) {
      console.warn(`Requested ${this.config.colorAttachments} draw buffers, but only ${this.maxDrawBuffers} supported`);
      this.config.colorAttachments = this.maxDrawBuffers;
    }
    
    // Check MSAA support
    if (this.config.enableMSAA) {
      const maxSamples = gl.getParameter(gl.MAX_SAMPLES);
      if (this.config.msaaSamples > maxSamples) {
        console.warn(`Requested ${this.config.msaaSamples} MSAA samples, but only ${maxSamples} supported`);
        this.config.msaaSamples = maxSamples;
      }
    }
  }
  
  /**
   * Create fullscreen quad for post-processing
   */
  private createFullscreenQuad(): void {
    const gl = this.gl;
    
    // Fullscreen quad vertices (NDC coordinates)
    const vertices = new Float32Array([
      -1, -1, 0, 0, // bottom-left
       1, -1, 1, 0, // bottom-right
      -1,  1, 0, 1, // top-left
       1,  1, 1, 1  // top-right
    ]);
    
    const indices = new Uint16Array([
      0, 1, 2, // first triangle
      1, 3, 2  // second triangle
    ]);
    
    // Create VAO
    this.fullscreenQuadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.fullscreenQuadVAO);
    
    // Create vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Create index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    // Set up vertex attributes
    // Position (location 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    
    // UV coordinates (location 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    
    gl.bindVertexArray(null);
  }
  
  /**
   * Create render target with specified configuration
   */
  createRenderTarget(
    name: string,
    width: number,
    height: number,
    colorFormats: number[],
    depthFormat?: number,
    samples: number = 0
  ): RenderTarget {
    const gl = this.gl;
    
    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to create framebuffer');
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    
    // Create color textures
    const colorTextures: WebGLTexture[] = [];
    const drawBuffers: number[] = [];
    
    for (let i = 0; i < colorFormats.length; i++) {
      const texture = this.createColorTexture(width, height, colorFormats[i], samples);
      colorTextures.push(texture);
      
      if (samples > 0) {
        // Multisampled texture (using regular texture due to compatibility)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          texture,
          0
        );
      } else {
        // Regular texture
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          texture,
          0
        );
      }
      
      drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
    }
    
    // Set draw buffers
    gl.drawBuffers(drawBuffers);
    
    // Create depth texture if requested
    let depthTexture: WebGLTexture | undefined;
    if (depthFormat) {
      depthTexture = this.createDepthTexture(width, height, depthFormat, samples);
      
      if (samples > 0) {
        // Multisampled depth texture (using regular texture due to compatibility)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          depthTexture,
          0
        );
      } else {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          depthTexture,
          0
        );
      }
    }
    
    // Check framebuffer completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${this.getFramebufferStatusString(status)}`);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    const renderTarget: RenderTarget = {
      framebuffer,
      colorTextures,
      depthTexture,
      width,
      height,
      samples,
      colorFormats,
      depthFormat
    };
    
    this.renderTargets.set(name, renderTarget);
    return renderTarget;
  }
  
  /**
   * Create color texture for render target
   */
  private createColorTexture(width: number, height: number, format: number, samples: number): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    if (!texture) {
      throw new Error('Failed to create color texture');
    }
    
    if (samples > 0) {
      // Multisampled texture (fallback to regular for compatibility)
      console.warn('MSAA textures not fully supported in WebGL2, using regular textures');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      // Regular texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      
      // Set filtering
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    return texture;
  }
  
  /**
   * Create depth texture for render target
   */
  private createDepthTexture(width: number, height: number, format: number, samples: number): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    if (!texture) {
      throw new Error('Failed to create depth texture');
    }
    
    if (samples > 0) {
      // Multisampled depth texture (fallback to regular for compatibility)
      console.warn('MSAA depth textures not fully supported in WebGL2, using regular textures');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      // Regular depth texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      
      // Set filtering (depth textures often use nearest filtering)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    return texture;
  }
  
  /**
   * Create G-Buffer for deferred rendering
   */
  createGBuffer(width: number, height: number): GBuffer {
    const gl = this.gl;
    
    // Define G-Buffer layout
    const colorFormats = [
      gl.RGBA8,     // Albedo + metallic
      gl.RGBA8,     // Normal + roughness  
      gl.RGBA16F,   // Position + AO (needs high precision)
      gl.RGBA8,     // Motion vectors + depth
      gl.RGBA8      // Emission + flags
    ];
    
    const depthFormat = gl.DEPTH_COMPONENT24;
    const samples = this.config.enableMSAA ? this.config.msaaSamples : 0;
    
    const renderTarget = this.createRenderTarget(
      'gBuffer',
      width,
      height,
      colorFormats,
      depthFormat,
      samples
    );
    
    const gBuffer: GBuffer = {
      ...renderTarget,
      albedoMetallic: renderTarget.colorTextures[0],
      normalRoughness: renderTarget.colorTextures[1],
      positionAO: renderTarget.colorTextures[2],
      motionDepth: renderTarget.colorTextures[3],
      emissionFlags: renderTarget.colorTextures[4]
    };
    
    this.gBuffer = gBuffer;
    return gBuffer;
  }
  
  /**
   * Create post-processing target
   */
  createPostProcessTarget(width: number, height: number, enableHDR: boolean = false): PostProcessTarget {
    const gl = this.gl;
    
    const colorFormats = enableHDR 
      ? [gl.RGBA16F, gl.RGBA16F, gl.RG16F] // HDR + bright + velocity
      : [gl.RGBA8, gl.RGBA8, gl.RG8];      // LDR + bright + velocity
    
    const renderTarget = this.createRenderTarget(
      `postProcess_${this.postProcessTargets.length}`,
      width,
      height,
      colorFormats,
      gl.DEPTH_COMPONENT24
    );
    
    const postProcessTarget: PostProcessTarget = {
      ...renderTarget,
      hdrColor: renderTarget.colorTextures[0],
      brightColor: renderTarget.colorTextures[1],
      velocity: renderTarget.colorTextures[2]
    };
    
    this.postProcessTargets.push(postProcessTarget);
    return postProcessTarget;
  }
  
  /**
   * Create screen-space ambient occlusion (SSAO) effect
   */
  createSSAOEffect(): ScreenSpaceEffect {
    const gl = this.gl;
    
    const vertexSource = `#version 300 es
      precision highp float;
      
      layout(location = 0) in vec2 a_position;
      layout(location = 1) in vec2 a_uv;
      
      out vec2 v_uv;
      
      void main() {
        v_uv = a_uv;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec2 v_uv;
      out vec4 fragColor;
      
      uniform sampler2D u_gBufferPosition;
      uniform sampler2D u_gBufferNormal;
      uniform sampler2D u_gBufferDepth;
      uniform sampler2D u_noiseTexture;
      
      uniform mat4 u_projectionMatrix;
      uniform mat4 u_viewMatrix;
      uniform vec3 u_samples[64]; // SSAO kernel samples
      uniform float u_radius;
      uniform float u_bias;
      uniform vec2 u_noiseScale;
      
      void main() {
        // Get G-buffer data
        vec3 fragPos = texture(u_gBufferPosition, v_uv).xyz;
        vec3 normal = normalize(texture(u_gBufferNormal, v_uv).xyz * 2.0 - 1.0);
        
        // Create TBN matrix for transforming samples to world space
        vec3 randomVec = normalize(texture(u_noiseTexture, v_uv * u_noiseScale).xyz);
        vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
        vec3 bitangent = cross(normal, tangent);
        mat3 TBN = mat3(tangent, bitangent, normal);
        
        // Sample around the fragment position
        float occlusion = 0.0;
        for (int i = 0; i < 64; ++i) {
          // Get sample position
          vec3 samplePos = TBN * u_samples[i]; // From tangent to view-space
          samplePos = fragPos + samplePos * u_radius;
          
          // Project sample position to screen space
          vec4 offset = vec4(samplePos, 1.0);
          offset = u_projectionMatrix * offset; // To clip-space
          offset.xyz /= offset.w; // Perspective divide
          offset.xyz = offset.xyz * 0.5 + 0.5; // Transform to [0,1] range
          
          // Get sample depth
          float sampleDepth = texture(u_gBufferPosition, offset.xy).z;
          
          // Range check & accumulate
          float rangeCheck = smoothstep(0.0, 1.0, u_radius / abs(fragPos.z - sampleDepth));
          occlusion += (sampleDepth >= samplePos.z + u_bias ? 1.0 : 0.0) * rangeCheck;
        }
        
        occlusion = 1.0 - (occlusion / 64.0);
        fragColor = vec4(vec3(occlusion), 1.0);
      }
    `;
    
    const program = this.createShaderProgram(vertexSource, fragmentSource);
    const uniforms = this.getUniformLocations(program, [
      'u_gBufferPosition', 'u_gBufferNormal', 'u_gBufferDepth', 'u_noiseTexture',
      'u_projectionMatrix', 'u_viewMatrix', 'u_samples', 'u_radius', 'u_bias', 'u_noiseScale'
    ]);
    
    return {
      name: 'ssao',
      program,
      inputs: ['gBufferPosition', 'gBufferNormal', 'gBufferDepth', 'noiseTexture'],
      output: 'ssaoTexture',
      uniforms,
      enabled: true
    };
  }
  
  /**
   * Create deferred lighting pass
   */
  createDeferredLightingEffect(): ScreenSpaceEffect {
    const gl = this.gl;
    
    const vertexSource = `#version 300 es
      precision highp float;
      
      layout(location = 0) in vec2 a_position;
      layout(location = 1) in vec2 a_uv;
      
      out vec2 v_uv;
      
      void main() {
        v_uv = a_uv;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec2 v_uv;
      out vec4 fragColor;
      
      uniform sampler2D u_gBufferAlbedo;
      uniform sampler2D u_gBufferNormal;
      uniform sampler2D u_gBufferPosition;
      uniform sampler2D u_gBufferEmission;
      uniform sampler2D u_ssaoTexture;
      
      // Light data
      struct DirectionalLight {
        vec3 direction;
        vec3 color;
        float intensity;
      };
      
      struct PointLight {
        vec3 position;
        vec3 color;
        float intensity;
        float radius;
      };
      
      uniform DirectionalLight u_dirLight;
      uniform PointLight u_pointLights[16];
      uniform int u_pointLightCount;
      uniform vec3 u_cameraPosition;
      
      // PBR calculations
      vec3 calculateDirectionalLight(DirectionalLight light, vec3 albedo, vec3 normal, vec3 position, float metallic, float roughness) {
        vec3 lightDir = normalize(-light.direction);
        vec3 viewDir = normalize(u_cameraPosition - position);
        vec3 halfwayDir = normalize(lightDir + viewDir);
        
        // Basic Lambert diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        
        // Simple Blinn-Phong specular (could be enhanced with proper PBR)
        float spec = pow(max(dot(normal, halfwayDir), 0.0), (1.0 - roughness) * 64.0);
        
        // Combine
        vec3 diffuse = albedo * diff * (1.0 - metallic);
        vec3 specular = mix(vec3(0.04), albedo, metallic) * spec;
        
        return (diffuse + specular) * light.color * light.intensity;
      }
      
      vec3 calculatePointLight(PointLight light, vec3 albedo, vec3 normal, vec3 position, float metallic, float roughness) {
        vec3 lightDir = light.position - position;
        float distance = length(lightDir);
        lightDir = normalize(lightDir);
        
        // Attenuation
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);
        attenuation = clamp(attenuation, 0.0, 1.0);
        
        vec3 viewDir = normalize(u_cameraPosition - position);
        vec3 halfwayDir = normalize(lightDir + viewDir);
        
        // Basic Lambert diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        
        // Simple Blinn-Phong specular
        float spec = pow(max(dot(normal, halfwayDir), 0.0), (1.0 - roughness) * 64.0);
        
        // Combine
        vec3 diffuse = albedo * diff * (1.0 - metallic);
        vec3 specular = mix(vec3(0.04), albedo, metallic) * spec;
        
        return (diffuse + specular) * light.color * light.intensity * attenuation;
      }
      
      void main() {
        // Sample G-buffer
        vec4 albedoMetallic = texture(u_gBufferAlbedo, v_uv);
        vec4 normalRoughness = texture(u_gBufferNormal, v_uv);
        vec4 positionAO = texture(u_gBufferPosition, v_uv);
        vec4 emission = texture(u_gBufferEmission, v_uv);
        
        vec3 albedo = albedoMetallic.rgb;
        float metallic = albedoMetallic.a;
        vec3 normal = normalize(normalRoughness.rgb * 2.0 - 1.0);
        float roughness = normalRoughness.a;
        vec3 position = positionAO.rgb;
        float ao = positionAO.a;
        
        // Sample SSAO
        float ssao = texture(u_ssaoTexture, v_uv).r;
        ao *= ssao; // Combine AO sources
        
        // Calculate lighting
        vec3 color = vec3(0.0);
        
        // Directional light
        color += calculateDirectionalLight(u_dirLight, albedo, normal, position, metallic, roughness);
        
        // Point lights
        for (int i = 0; i < u_pointLightCount && i < 16; ++i) {
          color += calculatePointLight(u_pointLights[i], albedo, normal, position, metallic, roughness);
        }
        
        // Apply ambient occlusion
        color *= ao;
        
        // Add emission
        color += emission.rgb;
        
        // Basic tone mapping (could be enhanced)
        color = color / (color + vec3(1.0));
        
        fragColor = vec4(color, 1.0);
      }
    `;
    
    const program = this.createShaderProgram(vertexSource, fragmentSource);
    const uniforms = this.getUniformLocations(program, [
      'u_gBufferAlbedo', 'u_gBufferNormal', 'u_gBufferPosition', 'u_gBufferEmission', 'u_ssaoTexture',
      'u_dirLight', 'u_pointLights', 'u_pointLightCount', 'u_cameraPosition'
    ]);
    
    return {
      name: 'deferredLighting',
      program,
      inputs: ['gBufferAlbedo', 'gBufferNormal', 'gBufferPosition', 'gBufferEmission', 'ssaoTexture'],
      output: 'litScene',
      uniforms,
      enabled: true
    };
  }
  
  /**
   * Bind render target for rendering
   */
  bindRenderTarget(name: string): boolean {
    const renderTarget = this.renderTargets.get(name);
    if (!renderTarget) {
      console.warn(`Render target ${name} not found`);
      return false;
    }
    
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget.framebuffer);
    gl.viewport(0, 0, renderTarget.width, renderTarget.height);
    
    return true;
  }
  
  /**
   * Bind default framebuffer
   */
  bindDefaultFramebuffer(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  
  /**
   * Render fullscreen quad with specified effect
   */
  renderFullscreenEffect(effect: ScreenSpaceEffect, inputTextures: Map<string, WebGLTexture>): void {
    if (!effect.enabled || !this.fullscreenQuadVAO) {
      return;
    }
    
    const gl = this.gl;
    
    // Use effect program
    gl.useProgram(effect.program);
    
    // Bind input textures
    let textureUnit = 0;
    for (const [inputName, texture] of inputTextures) {
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      const uniformLocation = effect.uniforms.get(`u_${inputName}`);
      if (uniformLocation) {
        gl.uniform1i(uniformLocation, textureUnit);
      }
      
      textureUnit++;
    }
    
    // Render fullscreen quad
    gl.bindVertexArray(this.fullscreenQuadVAO);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
  
  /**
   * Create shader program
   */
  private createShaderProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
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
  private compileShader(type: number, source: string): WebGLShader {
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
  private getUniformLocations(program: WebGLProgram, uniformNames: string[]): Map<string, WebGLUniformLocation> {
    const gl = this.gl;
    const uniforms = new Map<string, WebGLUniformLocation>();
    
    for (const name of uniformNames) {
      const location = gl.getUniformLocation(program, name);
      if (location) {
        uniforms.set(name, location);
      }
    }
    
    return uniforms;
  }
  
  /**
   * Get framebuffer status string
   */
  private getFramebufferStatusString(status: number): string {
    const gl = this.gl;
    
    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
      case gl.FRAMEBUFFER_UNSUPPORTED:
        return 'FRAMEBUFFER_UNSUPPORTED';
      case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
        return 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE';
      default:
        return `Unknown status: ${status}`;
    }
  }
  
  /**
   * Resize render targets
   */
  resizeRenderTargets(width: number, height: number): void {
    // Dispose existing render targets
    this.dispose();
    
    // Recreate with new dimensions
    if (this.config.enableGBuffer) {
      this.createGBuffer(width, height);
    }
    
    // Recreate post-process targets
    const postProcessCount = this.postProcessTargets.length;
    this.postProcessTargets = [];
    
    for (let i = 0; i < postProcessCount; i++) {
      this.createPostProcessTarget(width, height, this.config.enableHDR);
    }
  }
  
  /**
   * Get render target by name
   */
  getRenderTarget(name: string): RenderTarget | undefined {
    return this.renderTargets.get(name);
  }
  
  /**
   * Get G-buffer
   */
  getGBuffer(): GBuffer | undefined {
    return this.gBuffer;
  }
  
  /**
   * Get configuration
   */
  getConfig(): DeferredRenderingConfig {
    return { ...this.config };
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    const gl = this.gl;
    
    // Delete render targets
    for (const [name, renderTarget] of this.renderTargets) {
      gl.deleteFramebuffer(renderTarget.framebuffer);
      
      for (const colorTexture of renderTarget.colorTextures) {
        gl.deleteTexture(colorTexture);
      }
      
      if (renderTarget.depthTexture) {
        gl.deleteTexture(renderTarget.depthTexture);
      }
      
      if (renderTarget.stencilTexture) {
        gl.deleteTexture(renderTarget.stencilTexture);
      }
    }
    
    this.renderTargets.clear();
    this.gBuffer = undefined;
    this.postProcessTargets = [];
    
    // Delete screen-space effects
    for (const effect of this.screenSpaceEffects) {
      gl.deleteProgram(effect.program);
    }
    this.screenSpaceEffects = [];
    
    // Delete fullscreen quad VAO
    if (this.fullscreenQuadVAO) {
      gl.deleteVertexArray(this.fullscreenQuadVAO);
      this.fullscreenQuadVAO = undefined;
    }
  }
}