// Instanced rendering system for efficient batch drawing of sprites
// Implements quad-based sprite instancing with per-instance transforms and UV rectangles

export interface InstanceData {
  // Transform data (position, rotation, scale)
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  
  // UV rectangle in atlas texture (normalized 0-1 coordinates)
  uvX: number;
  uvY: number;
  uvWidth: number;
  uvHeight: number;
  
  // Optional tinting/alpha
  tintR?: number;
  tintG?: number;
  tintB?: number;
  alpha?: number;
}

export interface BatchRenderCall {
  texture: WebGLTexture;
  instances: InstanceData[];
  blendMode?: 'normal' | 'additive' | 'multiply';
}

export class InstancedRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private shaderProgram: WebGLProgram | null = null;
  private quadVAO: WebGLVertexArrayObject | null = null;
  private instanceVBO: WebGLBuffer | null = null;
  private quadVBO: WebGLBuffer | null = null;
  
  // Shader attribute/uniform locations
  private locations: {
    // Vertex attributes
    aPosition?: number;
    aUV?: number;
    aInstanceTransform?: number;
    aInstanceUV?: number;
    aInstanceTint?: number;
    
    // Uniforms
    uProjectionMatrix?: WebGLUniformLocation | null;
    uTexture?: WebGLUniformLocation | null;
  } = {};
  
  // Maximum instances per batch (WebGL limits)
  private maxInstancesPerBatch: number = 1000;
  private instanceBuffer: Float32Array;
  
  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl;
    this.instanceBuffer = new Float32Array(this.maxInstancesPerBatch * this.getInstanceDataSize());
  }
  
  /**
   * Initialize the instanced renderer with shaders and buffers
   */
  init(): boolean {
    try {
      if (!this.createShaderProgram()) return false;
      if (!this.createBuffers()) return false;
      if (!this.setupVertexArrays()) return false;
      return true;
    } catch (error) {
      console.error('Failed to initialize instanced renderer:', error);
      return false;
    }
  }
  
  /**
   * Render a batch of instances with the same texture
   */
  renderBatch(batch: BatchRenderCall, projectionMatrix: Float32Array): void {
    if (!this.shaderProgram || !this.quadVAO || batch.instances.length === 0) return;
    
    const gl = this.gl;
    
    // Use instanced shader program
    gl.useProgram(this.shaderProgram);
    
    // Set projection matrix
    if (this.locations.uProjectionMatrix) {
      gl.uniformMatrix4fv(this.locations.uProjectionMatrix, false, projectionMatrix);
    }
    
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, batch.texture);
    if (this.locations.uTexture) {
      gl.uniform1i(this.locations.uTexture, 0);
    }
    
    // Set blend mode
    this.setBlendMode(batch.blendMode || 'normal');
    
    // Bind VAO (contains quad geometry and instance data)
    if (this.isWebGL2Like() && this.quadVAO) {
      (gl as any).bindVertexArray(this.quadVAO);
    }
    
    // Process instances in batches if needed
    const instanceCount = batch.instances.length;
    let processedInstances = 0;
    
    while (processedInstances < instanceCount) {
      const batchSize = Math.min(this.maxInstancesPerBatch, instanceCount - processedInstances);
      const instanceSlice = batch.instances.slice(processedInstances, processedInstances + batchSize);
      
      // Upload instance data to buffer
      this.uploadInstanceData(instanceSlice);
      
      // Draw instanced quads
      if (this.isWebGL2Like()) {
        // WebGL2-like: Use drawArraysInstanced
        (gl as any).drawArraysInstanced(gl.TRIANGLES, 0, 6, batchSize);
      } else {
        // WebGL1: Check for instancing extension
        const ext = gl.getExtension('ANGLE_instanced_arrays');
        if (ext) {
          ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, batchSize);
        } else {
          // Fallback: draw individually (less efficient)
          this.fallbackNonInstancedDraw(instanceSlice, projectionMatrix);
        }
      }
      
      processedInstances += batchSize;
    }
    
    // Cleanup
    if (this.isWebGL2Like() && this.quadVAO) {
      (gl as any).bindVertexArray(null);
    }
  }
  
  /**
   * Dispose of WebGL resources
   */
  dispose(): void {
    const gl = this.gl;
    
    if (this.shaderProgram) {
      gl.deleteProgram(this.shaderProgram);
      this.shaderProgram = null;
    }
    
    if (this.quadVAO && this.isWebGL2Like()) {
      (gl as any).deleteVertexArray(this.quadVAO);
      this.quadVAO = null;
    }
    
    if (this.instanceVBO) {
      gl.deleteBuffer(this.instanceVBO);
      this.instanceVBO = null;
    }
    
    if (this.quadVBO) {
      gl.deleteBuffer(this.quadVBO);
      this.quadVBO = null;
    }
  }
  
  // -- Private implementation methods --
  
  private createShaderProgram(): boolean {
    const gl = this.gl;
    
    const vertexShaderSource = this.getVertexShaderSource();
    const fragmentShaderSource = this.getFragmentShaderSource();
    
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return false;
    
    this.shaderProgram = gl.createProgram();
    if (!this.shaderProgram) return false;
    
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
    
    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
      console.error('Shader program link error:', gl.getProgramInfoLog(this.shaderProgram));
      return false;
    }
    
    // Get attribute and uniform locations
    this.locations.aPosition = gl.getAttribLocation(this.shaderProgram, 'aPosition');
    this.locations.aUV = gl.getAttribLocation(this.shaderProgram, 'aUV');
    this.locations.aInstanceTransform = gl.getAttribLocation(this.shaderProgram, 'aInstanceTransform');
    this.locations.aInstanceUV = gl.getAttribLocation(this.shaderProgram, 'aInstanceUV');
    this.locations.aInstanceTint = gl.getAttribLocation(this.shaderProgram, 'aInstanceTint');
    
    this.locations.uProjectionMatrix = gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
    this.locations.uTexture = gl.getUniformLocation(this.shaderProgram, 'uTexture');
    
    // Cleanup shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    return true;
  }
  
  private getVertexShaderSource(): string {
    const isWebGL2 = this.isWebGL2Like();
    const version = isWebGL2 ? '#version 300 es' : '';
    const inKeyword = isWebGL2 ? 'in' : 'attribute';
    const outKeyword = isWebGL2 ? 'out' : 'varying';
    
    return `${version}
      precision highp float;
      
      // Quad vertex attributes
      ${inKeyword} vec2 aPosition;
      ${inKeyword} vec2 aUV;
      
      // Per-instance attributes
      ${inKeyword} vec4 aInstanceTransform; // x, y, rotation, scale
      ${inKeyword} vec4 aInstanceUV;        // uvX, uvY, uvWidth, uvHeight
      ${inKeyword} vec4 aInstanceTint;      // r, g, b, alpha
      
      // Uniforms
      uniform mat4 uProjectionMatrix;
      
      // Output to fragment shader
      ${outKeyword} vec2 vUV;
      ${outKeyword} vec4 vTint;
      
      void main() {
        // Extract instance data
        vec2 instancePos = aInstanceTransform.xy;
        float rotation = aInstanceTransform.z;
        float scale = aInstanceTransform.w;
        
        // Apply rotation and scale to quad vertex
        float cos_r = cos(rotation);
        float sin_r = sin(rotation);
        vec2 rotatedPos = vec2(
          aPosition.x * cos_r - aPosition.y * sin_r,
          aPosition.x * sin_r + aPosition.y * cos_r
        ) * scale;
        
        // Final world position
        vec2 worldPos = instancePos + rotatedPos;
        
        // Transform to clip space
        gl_Position = uProjectionMatrix * vec4(worldPos, 0.0, 1.0);
        
        // Calculate UV coordinates within atlas
        vUV = aInstanceUV.xy + aUV * aInstanceUV.zw;
        vTint = aInstanceTint;
      }
    `;
  }
  
  private getFragmentShaderSource(): string {
    const isWebGL2 = this.isWebGL2Like();
    const version = isWebGL2 ? '#version 300 es' : '';
    const inKeyword = isWebGL2 ? 'in' : 'varying';
    const outColor = isWebGL2 ? 'out vec4 fragColor;' : '';
    const gl_FragColor = isWebGL2 ? 'fragColor' : 'gl_FragColor';
    
    return `${version}
      precision highp float;
      
      ${inKeyword} vec2 vUV;
      ${inKeyword} vec4 vTint;
      
      uniform sampler2D uTexture;
      
      ${outColor}
      
      void main() {
        vec4 texColor = texture2D(uTexture, vUV);
        ${gl_FragColor} = texColor * vTint;
      }
    `;
  }
  
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  private createBuffers(): boolean {
    const gl = this.gl;
    
    // Create quad vertex buffer (two triangles forming a quad)
    this.quadVBO = gl.createBuffer();
    if (!this.quadVBO) return false;
    
    // Quad vertices: position (x, y) + UV (u, v)
    const quadVertices = new Float32Array([
      // Triangle 1
      -0.5, -0.5, 0.0, 1.0,  // Bottom-left
       0.5, -0.5, 1.0, 1.0,  // Bottom-right
      -0.5,  0.5, 0.0, 0.0,  // Top-left
      
      // Triangle 2
       0.5, -0.5, 1.0, 1.0,  // Bottom-right
       0.5,  0.5, 1.0, 0.0,  // Top-right
      -0.5,  0.5, 0.0, 0.0   // Top-left
    ]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
    // Create instance data buffer
    this.instanceVBO = gl.createBuffer();
    if (!this.instanceVBO) return false;
    
    return true;
  }
  
  private setupVertexArrays(): boolean {
    const gl: any = this.gl as any;
    
    if (this.isWebGL2Like()) {
      // WebGL2-like: Use VAO
      const gl2: any = gl;
      this.quadVAO = gl2.createVertexArray();
      if (!this.quadVAO) return false;
      
      gl2.bindVertexArray(this.quadVAO);
      
      // Set up quad vertex attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      
      if (this.locations.aPosition !== undefined && this.locations.aPosition >= 0) {
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 16, 0);
      }
      
      if (this.locations.aUV !== undefined && this.locations.aUV >= 0) {
        gl.enableVertexAttribArray(this.locations.aUV);
        gl.vertexAttribPointer(this.locations.aUV, 2, gl.FLOAT, false, 16, 8);
      }
      
      // Set up instance attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
      
      const stride = this.getInstanceDataSize() * 4; // 4 bytes per float
      
      if (this.locations.aInstanceTransform !== undefined && this.locations.aInstanceTransform >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceTransform);
        gl.vertexAttribPointer(this.locations.aInstanceTransform, 4, gl.FLOAT, false, stride, 0);
        gl2.vertexAttribDivisor(this.locations.aInstanceTransform, 1);
      }
      
      if (this.locations.aInstanceUV !== undefined && this.locations.aInstanceUV >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceUV);
        gl.vertexAttribPointer(this.locations.aInstanceUV, 4, gl.FLOAT, false, stride, 16);
        gl2.vertexAttribDivisor(this.locations.aInstanceUV, 1);
      }
      
      if (this.locations.aInstanceTint !== undefined && this.locations.aInstanceTint >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceTint);
        gl.vertexAttribPointer(this.locations.aInstanceTint, 4, gl.FLOAT, false, stride, 32);
        gl2.vertexAttribDivisor(this.locations.aInstanceTint, 1);
      }
      
      gl2.bindVertexArray(null);
    } else {
      // WebGL1 path: no VAO, still set up attributes so fallback can work
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      if (this.locations.aPosition !== undefined && this.locations.aPosition >= 0) {
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 16, 0);
      }
      if (this.locations.aUV !== undefined && this.locations.aUV >= 0) {
        gl.enableVertexAttribArray(this.locations.aUV);
        gl.vertexAttribPointer(this.locations.aUV, 2, gl.FLOAT, false, 16, 8);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
      const stride = this.getInstanceDataSize() * 4;
      if (this.locations.aInstanceTransform !== undefined && this.locations.aInstanceTransform >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceTransform);
        gl.vertexAttribPointer(this.locations.aInstanceTransform, 4, gl.FLOAT, false, stride, 0);
      }
      if (this.locations.aInstanceUV !== undefined && this.locations.aInstanceUV >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceUV);
        gl.vertexAttribPointer(this.locations.aInstanceUV, 4, gl.FLOAT, false, stride, 16);
      }
      if (this.locations.aInstanceTint !== undefined && this.locations.aInstanceTint >= 0) {
        gl.enableVertexAttribArray(this.locations.aInstanceTint);
        gl.vertexAttribPointer(this.locations.aInstanceTint, 4, gl.FLOAT, false, stride, 32);
      }
    }
    
    return true;
  }

  /**
   * Detect WebGL2-like features without referencing global WebGL2RenderingContext (which may be undefined).
   */
  private isWebGL2Like(): boolean {
    const gl: any = this.gl as any;
    return !!gl && typeof gl.drawArraysInstanced === 'function' && typeof gl.createVertexArray === 'function';
  }
  
  private getInstanceDataSize(): number {
    // Each instance: transform(4) + UV(4) + tint(4) = 12 floats
    return 12;
  }
  
  private uploadInstanceData(instances: InstanceData[]): void {
    const gl = this.gl;
    const dataSize = this.getInstanceDataSize();
    
    // Pack instance data into buffer
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      const offset = i * dataSize;
      
      // Transform data (x, y, rotation, scale)
      this.instanceBuffer[offset + 0] = instance.x;
      this.instanceBuffer[offset + 1] = instance.y;
      this.instanceBuffer[offset + 2] = instance.rotation;
      this.instanceBuffer[offset + 3] = Math.max(instance.scaleX, instance.scaleY); // Uniform scale for now
      
      // UV data (uvX, uvY, uvWidth, uvHeight)
      this.instanceBuffer[offset + 4] = instance.uvX;
      this.instanceBuffer[offset + 5] = instance.uvY;
      this.instanceBuffer[offset + 6] = instance.uvWidth;
      this.instanceBuffer[offset + 7] = instance.uvHeight;
      
      // Tint data (r, g, b, alpha)
      this.instanceBuffer[offset + 8] = instance.tintR ?? 1.0;
      this.instanceBuffer[offset + 9] = instance.tintG ?? 1.0;
      this.instanceBuffer[offset + 10] = instance.tintB ?? 1.0;
      this.instanceBuffer[offset + 11] = instance.alpha ?? 1.0;
    }
    
    // Upload to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceBuffer.subarray(0, instances.length * dataSize), gl.DYNAMIC_DRAW);
  }
  
  private setBlendMode(mode: 'normal' | 'additive' | 'multiply'): void {
    const gl = this.gl;
    
    gl.enable(gl.BLEND);
    
    switch (mode) {
      case 'additive':
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case 'multiply':
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        break;
      case 'normal':
      default:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }
  }
  
  private fallbackNonInstancedDraw(instances: InstanceData[], projectionMatrix: Float32Array): void {
    // Fallback for WebGL1 without instancing extension
    // This is less efficient but ensures compatibility
    const gl = this.gl;
    
    for (const instance of instances) {
      // Calculate model matrix for this instance
      const modelMatrix = this.createModelMatrix(instance);
      
      // Upload model matrix as uniform (requires shader modification for non-instanced path)
      // For now, this is a placeholder - in practice, you'd need separate shaders
      console.warn('Non-instanced fallback not fully implemented');
    }
  }
  
  private createModelMatrix(instance: InstanceData): Float32Array {
    const matrix = new Float32Array(16);
    
    // Create transformation matrix from instance data
    const cos_r = Math.cos(instance.rotation);
    const sin_r = Math.sin(instance.rotation);
    const scaleX = instance.scaleX;
    const scaleY = instance.scaleY;
    
    // 2D transformation matrix (homogeneous coordinates)
    matrix[0] = cos_r * scaleX;
    matrix[1] = sin_r * scaleX;
    matrix[2] = 0;
    matrix[3] = 0;
    
    matrix[4] = -sin_r * scaleY;
    matrix[5] = cos_r * scaleY;
    matrix[6] = 0;
    matrix[7] = 0;
    
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    
    matrix[12] = instance.x;
    matrix[13] = instance.y;
    matrix[14] = 0;
    matrix[15] = 1;
    
    return matrix;
  }
}