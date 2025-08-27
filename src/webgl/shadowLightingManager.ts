/**
 * Shadow Mapping and Dynamic Lighting System
 * Supports cascade shadow maps for directional lights and cube maps for point lights
 */

export interface ShadowMapConfig {
  /** Shadow map resolution */
  resolution: number;
  /** Cascade count for directional lights */
  cascadeCount: number;
  /** Near/far distances for cascades */
  cascadeDistances: number[];
  /** Shadow bias to prevent acne */
  bias: number;
  /** Normal offset bias */
  normalBias: number;
  /** PCF (Percentage Closer Filtering) sample count */
  pcfSamples: number;
  /** Enable VSM (Variance Shadow Maps) */
  useVSM: boolean;
}

export interface DirectionalLight {
  /** Light direction */
  direction: Float32Array;
  /** Light color */
  color: Float32Array;
  /** Light intensity */
  intensity: number;
  /** Cast shadows */
  castShadows: boolean;
  /** Shadow cascade data */
  cascades?: ShadowCascade[];
  /** Light space matrices */
  lightSpaceMatrices?: Float32Array[];
}

export interface PointLight {
  /** Light position */
  position: Float32Array;
  /** Light color */
  color: Float32Array;
  /** Light intensity */
  intensity: number;
  /** Light radius/range */
  radius: number;
  /** Cast shadows */
  castShadows: boolean;
  /** Shadow cube map */
  shadowCubeMap?: WebGLTexture;
  /** Light space matrices (6 faces) */
  lightSpaceMatrices?: Float32Array[];
}

export interface SpotLight {
  /** Light position */
  position: Float32Array;
  /** Light direction */
  direction: Float32Array;
  /** Light color */
  color: Float32Array;
  /** Light intensity */
  intensity: number;
  /** Inner cone angle */
  innerCone: number;
  /** Outer cone angle */
  outerCone: number;
  /** Light radius/range */
  radius: number;
  /** Cast shadows */
  castShadows: boolean;
  /** Shadow map */
  shadowMap?: WebGLTexture;
  /** Light space matrix */
  lightSpaceMatrix?: Float32Array;
}

export interface ShadowCascade {
  /** Near distance */
  near: number;
  /** Far distance */
  far: number;
  /** Orthographic projection bounds */
  bounds: {
    left: number;
    right: number;
    bottom: number;
    top: number;
  };
  /** Light space matrix */
  lightSpaceMatrix: Float32Array;
  /** Shadow map texture */
  shadowMap: WebGLTexture;
}

export interface LightCullingData {
  /** Light positions (vec4 array) */
  lightPositions: Float32Array;
  /** Light colors and intensities (vec4 array) */
  lightColors: Float32Array;
  /** Light parameters (radius, type, etc.) */
  lightParams: Float32Array;
  /** Number of lights */
  lightCount: number;
  /** Tile size for light culling */
  tileSize: number;
  /** Tile count X */
  tilesX: number;
  /** Tile count Y */
  tilesY: number;
}

/**
 * Shadow Mapping and Dynamic Lighting Manager
 */
export class ShadowLightingManager {
  private gl: WebGL2RenderingContext;
  private config: ShadowMapConfig;
  private directionalLights: DirectionalLight[] = [];
  private pointLights: PointLight[] = [];
  private spotLights: SpotLight[] = [];
  private shadowMapFramebuffer?: WebGLFramebuffer;
  private shadowCubeFramebuffer?: WebGLFramebuffer;
  private shadowRenderProgram?: WebGLProgram;
  private shadowCubeRenderProgram?: WebGLProgram;
  private lightCullingCompute?: WebGLProgram;
  private maxLights: number = 256;
  
  constructor(gl: WebGL2RenderingContext, config: ShadowMapConfig) {
    this.gl = gl;
    this.config = config;
    
    this.initializeShadowMapping();
  }
  
  /**
   * Initialize shadow mapping resources
   */
  private initializeShadowMapping(): void {
    this.createShadowMapFramebuffer();
    this.createShadowCubeFramebuffer();
    this.createShadowRenderPrograms();
  }
  
  /**
   * Create framebuffer for 2D shadow maps
   */
  private createShadowMapFramebuffer(): void {
    const gl = this.gl;
    
    this.shadowMapFramebuffer = gl.createFramebuffer();
    if (!this.shadowMapFramebuffer) {
      throw new Error('Failed to create shadow map framebuffer');
    }
  }
  
  /**
   * Create framebuffer for cube shadow maps
   */
  private createShadowCubeFramebuffer(): void {
    const gl = this.gl;
    
    this.shadowCubeFramebuffer = gl.createFramebuffer();
    if (!this.shadowCubeFramebuffer) {
      throw new Error('Failed to create shadow cube framebuffer');
    }
  }
  
  /**
   * Create shadow rendering programs
   */
  private createShadowRenderPrograms(): void {
    this.shadowRenderProgram = this.createShadowMapProgram();
    this.shadowCubeRenderProgram = this.createShadowCubeProgram();
  }
  
  /**
   * Create shadow map rendering program
   */
  private createShadowMapProgram(): WebGLProgram {
    const gl = this.gl;
    
    const vertexSource = `#version 300 es
      precision highp float;
      
      in vec3 a_position;
      
      uniform mat4 u_lightSpaceMatrix;
      uniform mat4 u_modelMatrix;
      
      void main() {
        gl_Position = u_lightSpaceMatrix * u_modelMatrix * vec4(a_position, 1.0);
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      void main() {
        // Depth is automatically written
        // For VSM, we could output depth and depth^2
      }
    `;
    
    return this.createShaderProgram(vertexSource, fragmentSource);
  }
  
  /**
   * Create shadow cube rendering program
   */
  private createShadowCubeProgram(): WebGLProgram {
    const gl = this.gl;
    
    const vertexSource = `#version 300 es
      precision highp float;
      
      in vec3 a_position;
      
      uniform mat4 u_lightSpaceMatrix;
      uniform mat4 u_modelMatrix;
      uniform vec3 u_lightPosition;
      
      out vec3 v_worldPos;
      
      void main() {
        vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
        v_worldPos = worldPos.xyz;
        gl_Position = u_lightSpaceMatrix * worldPos;
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec3 v_worldPos;
      
      uniform vec3 u_lightPosition;
      uniform float u_farPlane;
      
      void main() {
        // Calculate distance from light to fragment
        float distance = length(v_worldPos - u_lightPosition);
        
        // Normalize to [0, 1] range
        distance = distance / u_farPlane;
        
        // Write distance as depth
        gl_FragDepth = distance;
      }
    `;
    
    return this.createShaderProgram(vertexSource, fragmentSource);
  }
  
  /**
   * Create directional light with shadow support
   */
  createDirectionalLight(
    direction: [number, number, number],
    color: [number, number, number],
    intensity: number = 1.0,
    castShadows: boolean = true
  ): DirectionalLight {
    const light: DirectionalLight = {
      direction: new Float32Array(direction),
      color: new Float32Array([...color, 1.0]),
      intensity,
      castShadows
    };
    
    if (castShadows) {
      light.cascades = this.createShadowCascades();
      light.lightSpaceMatrices = [];
    }
    
    this.directionalLights.push(light);
    return light;
  }
  
  /**
   * Create shadow cascades for directional light
   */
  private createShadowCascades(): ShadowCascade[] {
    const gl = this.gl;
    const cascades: ShadowCascade[] = [];
    
    for (let i = 0; i < this.config.cascadeCount; i++) {
      const near = i === 0 ? 0.1 : this.config.cascadeDistances[i - 1];
      const far = this.config.cascadeDistances[i];
      
      // Create shadow map texture
      const shadowMap = gl.createTexture();
      if (!shadowMap) {
        throw new Error('Failed to create shadow map texture');
      }
      
      gl.bindTexture(gl.TEXTURE_2D, shadowMap);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        this.config.resolution,
        this.config.resolution,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
      );
      
      // Set texture parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      
      const cascade: ShadowCascade = {
        near,
        far,
        bounds: { left: -50, right: 50, bottom: -50, top: 50 }, // Will be calculated
        lightSpaceMatrix: new Float32Array(16),
        shadowMap
      };
      
      cascades.push(cascade);
    }
    
    return cascades;
  }
  
  /**
   * Create point light with shadow support
   */
  createPointLight(
    position: [number, number, number],
    color: [number, number, number],
    intensity: number = 1.0,
    radius: number = 10.0,
    castShadows: boolean = true
  ): PointLight {
    const light: PointLight = {
      position: new Float32Array(position),
      color: new Float32Array([...color, 1.0]),
      intensity,
      radius,
      castShadows
    };
    
    if (castShadows) {
      light.shadowCubeMap = this.createShadowCubeMap();
      light.lightSpaceMatrices = this.createCubeMapMatrices(position, radius);
    }
    
    this.pointLights.push(light);
    return light;
  }
  
  /**
   * Create shadow cube map for point light
   */
  private createShadowCubeMap(): WebGLTexture {
    const gl = this.gl;
    
    const cubeMap = gl.createTexture();
    if (!cubeMap) {
      throw new Error('Failed to create shadow cube map');
    }
    
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);
    
    // Create 6 faces
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        gl.DEPTH_COMPONENT24,
        this.config.resolution,
        this.config.resolution,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
      );
    }
    
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    
    return cubeMap;
  }
  
  /**
   * Create view matrices for cube map faces
   */
  private createCubeMapMatrices(position: [number, number, number], radius: number): Float32Array[] {
    const matrices: Float32Array[] = [];
    
    // Cube map face directions and up vectors
    const faces = [
      { target: [1, 0, 0], up: [0, -1, 0] },   // +X
      { target: [-1, 0, 0], up: [0, -1, 0] },  // -X
      { target: [0, 1, 0], up: [0, 0, 1] },    // +Y
      { target: [0, -1, 0], up: [0, 0, -1] },  // -Y
      { target: [0, 0, 1], up: [0, -1, 0] },   // +Z
      { target: [0, 0, -1], up: [0, -1, 0] }   // -Z
    ];
    
    // Create projection matrix (90 degree FOV)
    const projection = this.createPerspectiveMatrix(Math.PI / 2, 1.0, 0.1, radius);
    
    for (const face of faces) {
      const view = this.createLookAtMatrix(
        position,
        [
          position[0] + face.target[0],
          position[1] + face.target[1],
          position[2] + face.target[2]
        ],
        face.up as [number, number, number]
      );
      
      // Combine projection and view
      const lightSpaceMatrix = this.multiplyMatrices(projection, view);
      matrices.push(lightSpaceMatrix);
    }
    
    return matrices;
  }
  
  /**
   * Render shadow maps for all lights
   */
  renderShadowMaps(sceneRenderCallback: (lightSpaceMatrix: Float32Array) => void): void {
    const gl = this.gl;
    
    // Store current viewport
    const viewport = gl.getParameter(gl.VIEWPORT);
    
    // Render directional light shadows
    for (const light of this.directionalLights) {
      if (light.castShadows && light.cascades) {
        this.renderDirectionalShadows(light, sceneRenderCallback);
      }
    }
    
    // Render point light shadows
    for (const light of this.pointLights) {
      if (light.castShadows && light.shadowCubeMap) {
        this.renderPointShadows(light, sceneRenderCallback);
      }
    }
    
    // Restore viewport
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
  }
  
  /**
   * Render shadows for directional light
   */
  private renderDirectionalShadows(
    light: DirectionalLight,
    sceneRenderCallback: (lightSpaceMatrix: Float32Array) => void
  ): void {
    const gl = this.gl;
    
    if (!light.cascades || !this.shadowMapFramebuffer || !this.shadowRenderProgram) {
      return;
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFramebuffer);
    gl.viewport(0, 0, this.config.resolution, this.config.resolution);
    
    // Use shadow render program
    gl.useProgram(this.shadowRenderProgram);
    
    // Render each cascade
    for (let i = 0; i < light.cascades.length; i++) {
      const cascade = light.cascades[i];
      
      // Attach shadow map to framebuffer
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        cascade.shadowMap,
        0
      );
      
      // Clear depth buffer
      gl.clear(gl.DEPTH_BUFFER_BIT);
      
      // Update light space matrix
      this.updateCascadeLightSpaceMatrix(light, cascade);
      
      // Set uniform
      const lightSpaceLocation = gl.getUniformLocation(this.shadowRenderProgram, 'u_lightSpaceMatrix');
      gl.uniformMatrix4fv(lightSpaceLocation, false, cascade.lightSpaceMatrix);
      
      // Render scene
      sceneRenderCallback(cascade.lightSpaceMatrix);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  
  /**
   * Render shadows for point light
   */
  private renderPointShadows(
    light: PointLight,
    sceneRenderCallback: (lightSpaceMatrix: Float32Array) => void
  ): void {
    const gl = this.gl;
    
    if (!light.shadowCubeMap || !light.lightSpaceMatrices || !this.shadowCubeFramebuffer || !this.shadowCubeRenderProgram) {
      return;
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowCubeFramebuffer);
    gl.viewport(0, 0, this.config.resolution, this.config.resolution);
    
    // Use shadow cube render program
    gl.useProgram(this.shadowCubeRenderProgram);
    
    // Set light position and far plane
    const lightPosLocation = gl.getUniformLocation(this.shadowCubeRenderProgram, 'u_lightPosition');
    const farPlaneLocation = gl.getUniformLocation(this.shadowCubeRenderProgram, 'u_farPlane');
    
    gl.uniform3fv(lightPosLocation, light.position);
    gl.uniform1f(farPlaneLocation, light.radius);
    
    // Render each cube face
    for (let face = 0; face < 6; face++) {
      // Attach cube face to framebuffer
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        light.shadowCubeMap,
        0
      );
      
      // Clear depth buffer
      gl.clear(gl.DEPTH_BUFFER_BIT);
      
      // Set light space matrix for this face
      const lightSpaceLocation = gl.getUniformLocation(this.shadowCubeRenderProgram, 'u_lightSpaceMatrix');
      gl.uniformMatrix4fv(lightSpaceLocation, false, light.lightSpaceMatrices[face]);
      
      // Render scene
      sceneRenderCallback(light.lightSpaceMatrices[face]);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  
  /**
   * Update cascade light space matrix
   */
  private updateCascadeLightSpaceMatrix(light: DirectionalLight, cascade: ShadowCascade): void {
    // Create orthographic projection for cascade
    const projection = this.createOrthographicMatrix(
      cascade.bounds.left,
      cascade.bounds.right,
      cascade.bounds.bottom,
      cascade.bounds.top,
      -100, // Near (extended for shadow casters)
      100   // Far
    );
    
    // Create view matrix from light direction
    const lightPos = [0, 0, 0]; // Will be calculated based on scene bounds
    const lightTarget = [
      lightPos[0] + light.direction[0],
      lightPos[1] + light.direction[1],
      lightPos[2] + light.direction[2]
    ];
    
    const view = this.createLookAtMatrix(
      lightPos as [number, number, number],
      lightTarget as [number, number, number],
      [0, 1, 0] // Up vector
    );
    
    // Combine projection and view
    cascade.lightSpaceMatrix = this.multiplyMatrices(projection, view);
  }
  
  /**
   * Create lighting shader with shadow support
   */
  createLightingShader(): WebGLProgram {
    const vertexSource = `#version 300 es
      precision highp float;
      
      in vec3 a_position;
      in vec3 a_normal;
      in vec2 a_uv;
      
      uniform mat4 u_modelMatrix;
      uniform mat4 u_viewMatrix;
      uniform mat4 u_projectionMatrix;
      uniform mat3 u_normalMatrix;
      
      // Shadow mapping
      uniform mat4 u_lightSpaceMatrices[4]; // Up to 4 cascades
      
      out vec3 v_worldPos;
      out vec3 v_normal;
      out vec2 v_uv;
      out vec4 v_lightSpacePos[4];
      
      void main() {
        vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
        v_worldPos = worldPos.xyz;
        v_normal = u_normalMatrix * a_normal;
        v_uv = a_uv;
        
        // Calculate light space positions for cascades
        for (int i = 0; i < 4; i++) {
          v_lightSpacePos[i] = u_lightSpaceMatrices[i] * worldPos;
        }
        
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec3 v_worldPos;
      in vec3 v_normal;
      in vec2 v_uv;
      in vec4 v_lightSpacePos[4];
      
      uniform sampler2D u_albedoTexture;
      uniform sampler2D u_shadowMaps[4];
      uniform samplerCube u_pointShadowMaps[16];
      
      // Lighting
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
      
      uniform DirectionalLight u_dirLights[4];
      uniform PointLight u_pointLights[16];
      uniform int u_dirLightCount;
      uniform int u_pointLightCount;
      
      uniform vec3 u_cameraPosition;
      uniform float u_shadowBias;
      uniform vec4 u_cascadeDistances;
      
      out vec4 fragColor;
      
      float calculateShadowPCF(sampler2D shadowMap, vec4 lightSpacePos, float bias) {
        // Perspective divide
        vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;
        
        if (projCoords.z > 1.0) return 0.0;
        
        // PCF (Percentage Closer Filtering)
        float shadow = 0.0;
        vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
        
        for (int x = -1; x <= 1; ++x) {
          for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += projCoords.z - bias > pcfDepth ? 1.0 : 0.0;
          }
        }
        
        return shadow / 9.0;
      }
      
      float calculatePointShadow(samplerCube shadowMap, vec3 fragPos, vec3 lightPos, float farPlane) {
        vec3 fragToLight = fragPos - lightPos;
        float currentDepth = length(fragToLight);
        
        float bias = 0.05;
        float shadow = 0.0;
        float samples = 4.0;
        float offset = 0.1;
        
        for (float x = -offset; x < offset; x += offset / (samples * 0.5)) {
          for (float y = -offset; y < offset; y += offset / (samples * 0.5)) {
            for (float z = -offset; z < offset; z += offset / (samples * 0.5)) {
              float closestDepth = texture(shadowMap, fragToLight + vec3(x, y, z)).r;
              closestDepth *= farPlane;
              if (currentDepth - bias > closestDepth) {
                shadow += 1.0;
              }
            }
          }
        }
        
        shadow /= (samples * samples * samples);
        return shadow;
      }
      
      vec3 calculateDirectionalLight(DirectionalLight light, vec3 normal, vec3 viewDir, vec3 albedo, int lightIndex) {
        vec3 lightDir = normalize(-light.direction);
        
        // Diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        
        // Specular (Blinn-Phong)
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
        
        // Calculate shadow
        float shadow = 0.0;
        if (lightIndex < 4) {
          // Select cascade based on depth
          float depth = length(u_cameraPosition - v_worldPos);
          int cascadeIndex = 0;
          
          if (depth < u_cascadeDistances.x) cascadeIndex = 0;
          else if (depth < u_cascadeDistances.y) cascadeIndex = 1;
          else if (depth < u_cascadeDistances.z) cascadeIndex = 2;
          else cascadeIndex = 3;
          
          if (cascadeIndex < 4) {
            shadow = calculateShadowPCF(u_shadowMaps[cascadeIndex], v_lightSpacePos[cascadeIndex], u_shadowBias);
          }
        }
        
        // Combine
        vec3 diffuse = albedo * diff;
        vec3 specular = vec3(0.3) * spec; // Simple specular
        
        return (diffuse + specular) * light.color * light.intensity * (1.0 - shadow);
      }
      
      vec3 calculatePointLight(PointLight light, vec3 normal, vec3 viewDir, vec3 albedo, int lightIndex) {
        vec3 lightDir = normalize(light.position - v_worldPos);
        float distance = length(light.position - v_worldPos);
        
        // Attenuation
        float attenuation = clamp(1.0 - distance / light.radius, 0.0, 1.0);
        attenuation *= attenuation;
        
        // Diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        
        // Specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
        
        // Calculate shadow
        float shadow = 0.0;
        if (lightIndex < 16) {
          shadow = calculatePointShadow(u_pointShadowMaps[lightIndex], v_worldPos, light.position, light.radius);
        }
        
        // Combine
        vec3 diffuse = albedo * diff;
        vec3 specular = vec3(0.3) * spec;
        
        return (diffuse + specular) * light.color * light.intensity * attenuation * (1.0 - shadow);
      }
      
      void main() {
        vec3 albedo = texture(u_albedoTexture, v_uv).rgb;
        vec3 normal = normalize(v_normal);
        vec3 viewDir = normalize(u_cameraPosition - v_worldPos);
        
        vec3 color = vec3(0.0);
        
        // Ambient lighting
        color += albedo * 0.1;
        
        // Directional lights
        for (int i = 0; i < u_dirLightCount && i < 4; i++) {
          color += calculateDirectionalLight(u_dirLights[i], normal, viewDir, albedo, i);
        }
        
        // Point lights
        for (int i = 0; i < u_pointLightCount && i < 16; i++) {
          color += calculatePointLight(u_pointLights[i], normal, viewDir, albedo, i);
        }
        
        fragColor = vec4(color, 1.0);
      }
    `;
    
    return this.createShaderProgram(vertexSource, fragmentSource);
  }
  
  /**
   * Matrix utility functions
   */
  private createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);
    
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ]);
  }
  
  private createOrthographicMatrix(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    
    return new Float32Array([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
    ]);
  }
  
  private createLookAtMatrix(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
    const zAxis = this.normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    const xAxis = this.normalize(this.cross(up, zAxis));
    const yAxis = this.cross(zAxis, xAxis);
    
    return new Float32Array([
      xAxis[0], yAxis[0], zAxis[0], 0,
      xAxis[1], yAxis[1], zAxis[1], 0,
      xAxis[2], yAxis[2], zAxis[2], 0,
      -this.dot(xAxis, eye), -this.dot(yAxis, eye), -this.dot(zAxis, eye), 1
    ]);
  }
  
  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    
    return result;
  }
  
  private normalize(v: number[]): number[] {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
  }
  
  private cross(a: number[], b: number[]): number[] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  
  private dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
   * Get all lights for shader uniforms
   */
  getDirectionalLights(): DirectionalLight[] {
    return this.directionalLights;
  }
  
  getPointLights(): PointLight[] {
    return this.pointLights;
  }
  
  getSpotLights(): SpotLight[] {
    return this.spotLights;
  }
  
  /**
   * Update light position (for point/spot lights)
   */
  updatePointLightPosition(index: number, position: [number, number, number]): boolean {
    if (index >= 0 && index < this.pointLights.length) {
      this.pointLights[index].position.set(position);
      
      // Update shadow cube matrices if casting shadows
      if (this.pointLights[index].castShadows) {
        this.pointLights[index].lightSpaceMatrices = this.createCubeMapMatrices(
          position,
          this.pointLights[index].radius
        );
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Get shadow map configuration
   */
  getConfig(): ShadowMapConfig {
    return { ...this.config };
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    const gl = this.gl;
    
    // Delete framebuffers
    if (this.shadowMapFramebuffer) {
      gl.deleteFramebuffer(this.shadowMapFramebuffer);
    }
    if (this.shadowCubeFramebuffer) {
      gl.deleteFramebuffer(this.shadowCubeFramebuffer);
    }
    
    // Delete programs
    if (this.shadowRenderProgram) {
      gl.deleteProgram(this.shadowRenderProgram);
    }
    if (this.shadowCubeRenderProgram) {
      gl.deleteProgram(this.shadowCubeRenderProgram);
    }
    if (this.lightCullingCompute) {
      gl.deleteProgram(this.lightCullingCompute);
    }
    
    // Delete shadow maps
    for (const light of this.directionalLights) {
      if (light.cascades) {
        for (const cascade of light.cascades) {
          gl.deleteTexture(cascade.shadowMap);
        }
      }
    }
    
    for (const light of this.pointLights) {
      if (light.shadowCubeMap) {
        gl.deleteTexture(light.shadowCubeMap);
      }
    }
    
    // Clear arrays
    this.directionalLights = [];
    this.pointLights = [];
    this.spotLights = [];
  }
}