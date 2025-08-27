/**
 * WebGL2 Compute Shader and Uniform Buffer Object support
 * Provides GPU-side culling, frustum testing, and particle system updates
 */

export interface UniformBufferObject {
  /** WebGL buffer object */
  buffer: WebGLBuffer;
  /** Binding point for this UBO */
  bindingPoint: number;
  /** Size in bytes */
  size: number;
  /** Usage pattern */
  usage: number;
  /** Data layout descriptor */
  layout: UBOLayout;
}

export interface UBOLayout {
  /** Total size in bytes */
  totalSize: number;
  /** Field definitions */
  fields: UBOField[];
  /** Aligned field offsets */
  offsets: Map<string, number>;
}

export interface UBOField {
  /** Field name */
  name: string;
  /** Data type */
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat3' | 'mat4' | 'int' | 'ivec2' | 'ivec3' | 'ivec4';
  /** Array size (1 for single values) */
  arraySize: number;
  /** Size in bytes */
  size: number;
  /** Alignment requirements */
  alignment: number;
}

export interface ComputeShaderProgram {
  /** WebGL program object */
  program: WebGLProgram;
  /** Compute shader source */
  source: string;
  /** Work group size */
  workGroupSize: [number, number, number];
  /** Uniform locations */
  uniforms: Map<string, WebGLUniformLocation>;
  /** UBO binding points */
  uboBindings: Map<string, number>;
}

export interface FrustumCullingData {
  /** Frustum planes (6 planes, 4 components each) */
  frustumPlanes: Float32Array;
  /** Object positions (x, y, z, radius) */
  objectPositions: Float32Array;
  /** Visibility results (1 = visible, 0 = culled) */
  visibilityResults: Uint32Array;
  /** Number of objects */
  objectCount: number;
}

/**
 * WebGL2 Compute Shader Manager
 */
export class ComputeShaderManager {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, ComputeShaderProgram>();
  private ubos = new Map<string, UniformBufferObject>();
  private nextBindingPoint = 0;
  private isComputeSupported: boolean;
  
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.isComputeSupported = this.checkComputeShaderSupport();
    
    if (!this.isComputeSupported) {
      console.warn('Compute shaders not supported, falling back to vertex/fragment alternatives');
    }
  }
  
  /**
   * Check if compute shaders are supported
   */
  private checkComputeShaderSupport(): boolean {
    // Note: Compute shaders are part of WebGL2 Compute (separate spec)
    // For now, we'll simulate compute-like operations with vertex/fragment shaders
    return false; // WebGL2 Compute is not widely supported yet
  }
  
  /**
   * Create a Uniform Buffer Object with specified layout
   */
  createUBO(name: string, layout: UBOField[], usage: number = this.gl.DYNAMIC_DRAW): UniformBufferObject {
    const gl = this.gl;
    
    // Calculate layout with proper alignment
    const processedLayout = this.calculateUBOLayout(layout);
    
    // Create buffer
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create UBO buffer');
    }
    
    const bindingPoint = this.nextBindingPoint++;
    
    // Bind and allocate buffer
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, processedLayout.totalSize, usage);
    
    // Bind to binding point
    gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPoint, buffer);
    
    const ubo: UniformBufferObject = {
      buffer,
      bindingPoint,
      size: processedLayout.totalSize,
      usage,
      layout: processedLayout
    };
    
    this.ubos.set(name, ubo);
    return ubo;
  }
  
  /**
   * Calculate UBO layout with proper alignment
   */
  private calculateUBOLayout(fields: UBOField[]): UBOLayout {
    const offsets = new Map<string, number>();
    let currentOffset = 0;
    
    // Process each field with proper alignment
    for (const field of fields) {
      // Align to field alignment requirement
      currentOffset = this.alignOffset(currentOffset, field.alignment);
      offsets.set(field.name, currentOffset);
      
      // Advance by field size * array size
      currentOffset += field.size * field.arraySize;
    }
    
    // Final alignment to 16 bytes (vec4 alignment)
    const totalSize = this.alignOffset(currentOffset, 16);
    
    return {
      totalSize,
      fields,
      offsets
    };
  }
  
  /**
   * Align offset to specified alignment
   */
  private alignOffset(offset: number, alignment: number): number {
    return Math.ceil(offset / alignment) * alignment;
  }
  
  /**
   * Update UBO data
   */
  updateUBO(name: string, data: Record<string, number | Float32Array | Int32Array>): boolean {
    const ubo = this.ubos.get(name);
    if (!ubo) {
      console.warn(`UBO ${name} not found`);
      return false;
    }
    
    const gl = this.gl;
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo.buffer);
    
    // Update individual fields
    for (const [fieldName, value] of Object.entries(data)) {
      const offset = ubo.layout.offsets.get(fieldName);
      if (offset === undefined) {
        console.warn(`Field ${fieldName} not found in UBO ${name}`);
        continue;
      }
      
      // Convert value to appropriate format and upload
      if (typeof value === 'number') {
        const floatArray = new Float32Array([value]);
        gl.bufferSubData(gl.UNIFORM_BUFFER, offset, floatArray);
      } else if (value instanceof Float32Array || value instanceof Int32Array) {
        gl.bufferSubData(gl.UNIFORM_BUFFER, offset, value);
      }
    }
    
    return true;
  }
  
  /**
   * Create compute-like shader using transform feedback
   */
  createTransformFeedbackProgram(
    name: string,
    vertexSource: string,
    fragmentSource: string,
    varyings: string[]
  ): ComputeShaderProgram {
    const gl = this.gl;
    
    // Create and compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    
    // Create program
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    // Specify transform feedback varyings before linking
    gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
    
    // Link program
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Failed to link program: ${error}`);
    }
    
    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    // Get uniform locations
    const uniforms = new Map<string, WebGLUniformLocation>();
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      if (uniformInfo) {
        const location = gl.getUniformLocation(program, uniformInfo.name);
        if (location) {
          uniforms.set(uniformInfo.name, location);
        }
      }
    }
    
    // Get UBO binding points
    const uboBindings = new Map<string, number>();
    const uniformBlockCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
    
    for (let i = 0; i < uniformBlockCount; i++) {
      const blockName = gl.getActiveUniformBlockName(program, i);
      if (blockName) {
        const bindingPoint = this.nextBindingPoint++;
        gl.uniformBlockBinding(program, i, bindingPoint);
        uboBindings.set(blockName, bindingPoint);
      }
    }
    
    const computeProgram: ComputeShaderProgram = {
      program,
      source: vertexSource + '\n' + fragmentSource,
      workGroupSize: [1, 1, 1], // Not applicable for transform feedback
      uniforms,
      uboBindings
    };
    
    this.programs.set(name, computeProgram);
    return computeProgram;
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
   * Create frustum culling program
   */
  createFrustumCullingProgram(): ComputeShaderProgram {
    const vertexSource = `#version 300 es
      precision highp float;
      
      // Input attributes
      in vec4 a_position; // x, y, z, radius
      
      // Uniform buffer for frustum planes
      layout(std140) uniform FrustumData {
        vec4 frustumPlanes[6]; // 6 frustum planes
        mat4 viewProjectionMatrix;
        vec4 cameraPosition;
      };
      
      // Transform feedback output
      out float v_visibility; // 1.0 = visible, 0.0 = culled
      
      bool isInsideFrustum(vec3 center, float radius) {
        for (int i = 0; i < 6; i++) {
          vec4 plane = frustumPlanes[i];
          float distance = dot(plane.xyz, center) + plane.w;
          if (distance < -radius) {
            return false; // Outside this plane
          }
        }
        return true; // Inside all planes
      }
      
      void main() {
        vec3 worldPos = a_position.xyz;
        float radius = a_position.w;
        
        // Perform frustum test
        bool visible = isInsideFrustum(worldPos, radius);
        v_visibility = visible ? 1.0 : 0.0;
        
        // Transform position (required for vertex shader)
        gl_Position = viewProjectionMatrix * vec4(worldPos, 1.0);
      }
    `;
    
    const fragmentSource = `#version 300 es
      precision highp float;
      
      out vec4 fragColor;
      
      void main() {
        // Discard all fragments (we only care about transform feedback)
        discard;
      }
    `;
    
    return this.createTransformFeedbackProgram(
      'frustumCulling',
      vertexSource,
      fragmentSource,
      ['v_visibility']
    );
  }
  
  /**
   * Perform frustum culling on GPU
   */
  performFrustumCulling(
    cullingData: FrustumCullingData,
    viewProjectionMatrix: Float32Array,
    cameraPosition: Float32Array
  ): Uint32Array {
    const gl = this.gl;
    const program = this.programs.get('frustumCulling');
    
    if (!program) {
      throw new Error('Frustum culling program not created');
    }
    
    // Create or update UBO for frustum data
    let frustumUBO = this.ubos.get('FrustumData');
    if (!frustumUBO) {
      frustumUBO = this.createUBO('FrustumData', [
        { name: 'frustumPlanes', type: 'vec4', arraySize: 6, size: 16, alignment: 16 },
        { name: 'viewProjectionMatrix', type: 'mat4', arraySize: 1, size: 64, alignment: 16 },
        { name: 'cameraPosition', type: 'vec4', arraySize: 1, size: 16, alignment: 16 }
      ]);
    }
    
    // Update UBO data
    this.updateUBO('FrustumData', {
      frustumPlanes: cullingData.frustumPlanes,
      viewProjectionMatrix: viewProjectionMatrix,
      cameraPosition: cameraPosition
    });
    
    // Create vertex buffer for object positions
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cullingData.objectPositions, gl.STATIC_DRAW);
    
    // Create transform feedback buffer for results
    const resultBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, resultBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cullingData.objectCount * 4, gl.STATIC_READ); // 4 bytes per float
    
    // Create VAO
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    // Set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0); // vec4: x, y, z, radius
    
    // Use program
    gl.useProgram(program.program);
    
    // Bind UBO
    gl.bindBufferBase(gl.UNIFORM_BUFFER, frustumUBO.bindingPoint, frustumUBO.buffer);
    
    // Set up transform feedback
    const transformFeedback = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, resultBuffer);
    
    // Disable rasterization (we only want transform feedback)
    gl.enable(gl.RASTERIZER_DISCARD);
    
    // Begin transform feedback
    gl.beginTransformFeedback(gl.POINTS);
    
    // Draw (this triggers the vertex shader and transform feedback)
    gl.drawArrays(gl.POINTS, 0, cullingData.objectCount);
    
    // End transform feedback
    gl.endTransformFeedback();
    
    // Re-enable rasterization
    gl.disable(gl.RASTERIZER_DISCARD);
    
    // Read results
    gl.bindBuffer(gl.ARRAY_BUFFER, resultBuffer);
    const results = new Float32Array(cullingData.objectCount);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, results);
    
    // Convert to uint32 array (1 = visible, 0 = culled)
    const visibility = new Uint32Array(cullingData.objectCount);
    for (let i = 0; i < cullingData.objectCount; i++) {
      visibility[i] = results[i] > 0.5 ? 1 : 0;
    }
    
    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(resultBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteTransformFeedback(transformFeedback);
    
    return visibility;
  }
  
  /**
   * Generate frustum planes from view-projection matrix
   */
  static extractFrustumPlanes(viewProjectionMatrix: Float32Array): Float32Array {
    const planes = new Float32Array(24); // 6 planes * 4 components
    const m = viewProjectionMatrix;
    
    // Left plane
    planes[0] = m[3] + m[0];
    planes[1] = m[7] + m[4];
    planes[2] = m[11] + m[8];
    planes[3] = m[15] + m[12];
    
    // Right plane
    planes[4] = m[3] - m[0];
    planes[5] = m[7] - m[4];
    planes[6] = m[11] - m[8];
    planes[7] = m[15] - m[12];
    
    // Bottom plane
    planes[8] = m[3] + m[1];
    planes[9] = m[7] + m[5];
    planes[10] = m[11] + m[9];
    planes[11] = m[15] + m[13];
    
    // Top plane
    planes[12] = m[3] - m[1];
    planes[13] = m[7] - m[5];
    planes[14] = m[11] - m[9];
    planes[15] = m[15] - m[13];
    
    // Near plane
    planes[16] = m[3] + m[2];
    planes[17] = m[7] + m[6];
    planes[18] = m[11] + m[10];
    planes[19] = m[15] + m[14];
    
    // Far plane
    planes[20] = m[3] - m[2];
    planes[21] = m[7] - m[6];
    planes[22] = m[11] - m[10];
    planes[23] = m[15] - m[14];
    
    // Normalize planes
    for (let i = 0; i < 6; i++) {
      const base = i * 4;
      const length = Math.sqrt(
        planes[base] * planes[base] +
        planes[base + 1] * planes[base + 1] +
        planes[base + 2] * planes[base + 2]
      );
      
      if (length > 0) {
        planes[base] /= length;
        planes[base + 1] /= length;
        planes[base + 2] /= length;
        planes[base + 3] /= length;
      }
    }
    
    return planes;
  }
  
  /**
   * Get UBO field type information
   */
  static getUBOFieldInfo(type: string): { size: number; alignment: number } {
    switch (type) {
      case 'float':
      case 'int':
        return { size: 4, alignment: 4 };
      case 'vec2':
      case 'ivec2':
        return { size: 8, alignment: 8 };
      case 'vec3':
      case 'ivec3':
        return { size: 12, alignment: 16 }; // vec3 has 16-byte alignment
      case 'vec4':
      case 'ivec4':
        return { size: 16, alignment: 16 };
      case 'mat3':
        return { size: 48, alignment: 16 }; // 3 vec4s
      case 'mat4':
        return { size: 64, alignment: 16 }; // 4 vec4s
      default:
        throw new Error(`Unknown UBO field type: ${type}`);
    }
  }
  
  /**
   * Get program by name
   */
  getProgram(name: string): ComputeShaderProgram | undefined {
    return this.programs.get(name);
  }
  
  /**
   * Get UBO by name
   */
  getUBO(name: string): UniformBufferObject | undefined {
    return this.ubos.get(name);
  }
  
  /**
   * Get compute shader support status
   */
  isSupported(): boolean {
    return this.isComputeSupported;
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    const gl = this.gl;
    
    // Delete programs
    for (const [name, program] of this.programs) {
      gl.deleteProgram(program.program);
    }
    this.programs.clear();
    
    // Delete UBOs
    for (const [name, ubo] of this.ubos) {
      gl.deleteBuffer(ubo.buffer);
    }
    this.ubos.clear();
    
    this.nextBindingPoint = 0;
  }
}