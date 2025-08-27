/**
 * Unit tests for Phase 2 instanced rendering and texture atlas
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstancedRenderer } from '../../src/webgl/instancedRenderer';
import { TextureAtlas, AtlasManager } from '../../src/assets/textureAtlas';
// Mock WebGL context for testing
class MockWebGLContext {
    static VERTEX_SHADER = 0x8B31;
    static FRAGMENT_SHADER = 0x8B30;
    static COMPILE_STATUS = 0x8B81;
    static LINK_STATUS = 0x8B82;
    static TRIANGLES = 0x0004;
    static FLOAT = 0x1406;
    static ARRAY_BUFFER = 0x8892;
    static STATIC_DRAW = 0x88E4;
    static DYNAMIC_DRAW = 0x88E8;
    static TEXTURE_2D = 0x0DE1;
    static RGBA = 0x1908;
    static UNSIGNED_BYTE = 0x1401;
    static LINEAR = 0x2601;
    static CLAMP_TO_EDGE = 0x812F;
    static TEXTURE_MIN_FILTER = 0x2801;
    static TEXTURE_MAG_FILTER = 0x2800;
    static TEXTURE_WRAP_S = 0x2802;
    static TEXTURE_WRAP_T = 0x2803;
    static SRC_ALPHA = 0x0302;
    static ONE_MINUS_SRC_ALPHA = 0x0303;
    static ONE = 1;
    static BLEND = 0x0BE2;
    static TEXTURE0 = 0x84C0;
    static LINEAR_MIPMAP_LINEAR = 0x2703;
    mockObjects = new Map();
    nextId = 1;
    createShader(type) {
        const id = `shader_${this.nextId++}`;
        const shader = { id, type, compiled: false };
        this.mockObjects.set(id, shader);
        return shader;
    }
    createProgram() {
        const id = `program_${this.nextId++}`;
        const program = { id, linked: false };
        this.mockObjects.set(id, program);
        return program;
    }
    createBuffer() {
        const id = `buffer_${this.nextId++}`;
        const buffer = { id };
        this.mockObjects.set(id, buffer);
        return buffer;
    }
    createTexture() {
        const id = `texture_${this.nextId++}`;
        const texture = { id };
        this.mockObjects.set(id, texture);
        return texture;
    }
    createVertexArray() {
        const id = `vao_${this.nextId++}`;
        const vao = { id };
        this.mockObjects.set(id, vao);
        return vao;
    }
    shaderSource(shader, source) {
        if (shader)
            shader.source = source;
    }
    compileShader(shader) {
        if (shader)
            shader.compiled = true;
    }
    getShaderParameter(shader, pname) {
        return shader?.compiled || false;
    }
    getShaderInfoLog(shader) {
        return shader?.compiled ? '' : 'Mock compile error';
    }
    attachShader(program, shader) {
        if (program && shader) {
            program.shaders = program.shaders || [];
            program.shaders.push(shader);
        }
    }
    linkProgram(program) {
        if (program)
            program.linked = true;
    }
    getProgramParameter(program, pname) {
        return program?.linked || false;
    }
    getProgramInfoLog(program) {
        return program?.linked ? '' : 'Mock link error';
    }
    getAttribLocation(program, name) {
        const locations = {
            'aPosition': 0,
            'aUV': 1,
            'aInstanceTransform': 2,
            'aInstanceUV': 3,
            'aInstanceTint': 4
        };
        return locations[name] ?? -1;
    }
    getUniformLocation(program, name) {
        return { name, location: this.nextId++ };
    }
    deleteShader(shader) {
        if (shader?.id)
            this.mockObjects.delete(shader.id);
    }
    deleteProgram(program) {
        if (program?.id)
            this.mockObjects.delete(program.id);
    }
    deleteBuffer(buffer) {
        if (buffer?.id)
            this.mockObjects.delete(buffer.id);
    }
    deleteTexture(texture) {
        if (texture?.id)
            this.mockObjects.delete(texture.id);
    }
    deleteVertexArray(vao) {
        if (vao?.id)
            this.mockObjects.delete(vao.id);
    }
    // Mock methods that don't need implementation for basic tests
    useProgram() { }
    bindBuffer() { }
    bufferData() { }
    enableVertexAttribArray() { }
    vertexAttribPointer() { }
    vertexAttribDivisor() { }
    bindVertexArray() { }
    uniformMatrix4fv() { }
    uniform1i() { }
    activeTexture() { }
    bindTexture() { }
    enable() { }
    blendFunc() { }
    drawArraysInstanced() { }
    texImage2D() { }
    texParameteri() { }
    generateMipmap() { }
    pixelStorei() { }
    getExtension() { return null; }
}
// Create mock canvas for testing
function createMockCanvas(width = 64, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
describe('InstancedRenderer', () => {
    let mockGl;
    let renderer;
    beforeEach(() => {
        mockGl = new MockWebGLContext();
        renderer = new InstancedRenderer(mockGl);
    });
    afterEach(() => {
        renderer.dispose();
    });
    it('should initialize successfully', () => {
        const result = renderer.init();
        expect(result).toBe(true);
    });
    it('should handle shader compilation failure gracefully', () => {
        // Mock shader compilation failure
        const originalGetShaderParameter = mockGl.getShaderParameter;
        mockGl.getShaderParameter = () => false;
        const result = renderer.init();
        expect(result).toBe(false);
        // Restore
        mockGl.getShaderParameter = originalGetShaderParameter;
    });
    it('should render batch with valid instance data', () => {
        renderer.init();
        const instances = [
            {
                x: 100,
                y: 200,
                rotation: Math.PI / 4,
                scaleX: 1.5,
                scaleY: 1.5,
                uvX: 0,
                uvY: 0,
                uvWidth: 0.5,
                uvHeight: 0.5,
                tintR: 1,
                tintG: 0.5,
                tintB: 0.5,
                alpha: 0.8
            }
        ];
        const batch = {
            texture: mockGl.createTexture(),
            instances,
            blendMode: 'normal'
        };
        const projectionMatrix = new Float32Array(16);
        // Should not throw
        expect(() => {
            renderer.renderBatch(batch, projectionMatrix);
        }).not.toThrow();
    });
    it('should handle empty instance array', () => {
        renderer.init();
        const batch = {
            texture: mockGl.createTexture(),
            instances: [],
            blendMode: 'normal'
        };
        const projectionMatrix = new Float32Array(16);
        // Should not throw and should return early
        expect(() => {
            renderer.renderBatch(batch, projectionMatrix);
        }).not.toThrow();
    });
    it('should dispose resources properly', () => {
        renderer.init();
        // Should not throw
        expect(() => {
            renderer.dispose();
        }).not.toThrow();
    });
});
describe('TextureAtlas', () => {
    let mockGl;
    let atlas;
    beforeEach(() => {
        mockGl = new MockWebGLContext();
        atlas = new TextureAtlas(mockGl, {
            maxAtlasSize: 512,
            padding: 2,
            powerOfTwo: true
        });
    });
    afterEach(() => {
        atlas.dispose();
    });
    it('should initialize with correct dimensions', () => {
        const stats = atlas.getStats();
        expect(stats.atlasSize.width).toBe(512);
        expect(stats.atlasSize.height).toBe(512);
        expect(stats.entryCount).toBe(0);
        expect(stats.utilization).toBe(0);
    });
    it('should add canvas entry successfully', () => {
        const canvas = createMockCanvas(64, 64);
        const entry = atlas.addEntry('test-sprite', canvas);
        expect(entry).not.toBeNull();
        expect(entry.key).toBe('test-sprite');
        expect(entry.width).toBe(64);
        expect(entry.height).toBe(64);
        expect(entry.originalWidth).toBe(64);
        expect(entry.originalHeight).toBe(64);
        // Check UV coordinates are within [0, 1]
        expect(entry.uvX).toBeGreaterThanOrEqual(0);
        expect(entry.uvX).toBeLessThanOrEqual(1);
        expect(entry.uvY).toBeGreaterThanOrEqual(0);
        expect(entry.uvY).toBeLessThanOrEqual(1);
        expect(entry.uvWidth).toBeGreaterThan(0);
        expect(entry.uvWidth).toBeLessThanOrEqual(1);
        expect(entry.uvHeight).toBeGreaterThan(0);
        expect(entry.uvHeight).toBeLessThanOrEqual(1);
    });
    it('should return existing entry for duplicate keys', () => {
        const canvas = createMockCanvas(32, 32);
        const entry1 = atlas.addEntry('duplicate-test', canvas);
        const entry2 = atlas.addEntry('duplicate-test', canvas);
        expect(entry1).toBe(entry2);
    });
    it('should handle entries that do not fit', () => {
        // Try to add an entry larger than the atlas
        const largeCanvas = createMockCanvas(600, 600);
        const entry = atlas.addEntry('too-large', largeCanvas);
        expect(entry).toBeNull();
    });
    it('should pack multiple entries efficiently', () => {
        const entries = [];
        // Add several small entries
        for (let i = 0; i < 10; i++) {
            const canvas = createMockCanvas(32, 32);
            const entry = atlas.addEntry(`sprite-${i}`, canvas);
            expect(entry).not.toBeNull();
            entries.push(entry);
        }
        // Check that all entries have unique positions
        const positions = new Set(entries.map(e => `${e.x},${e.y}`));
        expect(positions.size).toBe(entries.length);
        // Check utilization
        const stats = atlas.getStats();
        expect(stats.utilization).toBeGreaterThan(0);
        expect(stats.entryCount).toBe(10);
    });
    it('should retrieve entries by key', () => {
        const canvas = createMockCanvas(48, 48);
        const originalEntry = atlas.addEntry('retrievable', canvas);
        const retrievedEntry = atlas.getEntry('retrievable');
        expect(retrievedEntry).toBe(originalEntry);
        const nonExistentEntry = atlas.getEntry('does-not-exist');
        expect(nonExistentEntry).toBeNull();
    });
    it('should clear all entries', () => {
        // Add some entries
        for (let i = 0; i < 5; i++) {
            const canvas = createMockCanvas(24, 24);
            atlas.addEntry(`clear-test-${i}`, canvas);
        }
        expect(atlas.getStats().entryCount).toBe(5);
        atlas.clear();
        expect(atlas.getStats().entryCount).toBe(0);
        expect(atlas.getStats().utilization).toBe(0);
    });
    it('should generate debug canvas', () => {
        // Add some entries first
        const canvas1 = createMockCanvas(32, 32);
        const canvas2 = createMockCanvas(48, 48);
        atlas.addEntry('debug-1', canvas1);
        atlas.addEntry('debug-2', canvas2);
        const debugCanvas = atlas.createDebugCanvas();
        expect(debugCanvas).not.toBeNull();
        expect(debugCanvas.width).toBe(512);
        expect(debugCanvas.height).toBe(512);
    });
});
describe('AtlasManager', () => {
    let mockGl;
    let manager;
    beforeEach(() => {
        mockGl = new MockWebGLContext();
        manager = new AtlasManager(mockGl, {
            maxAtlasSize: 256,
            padding: 1
        });
    });
    afterEach(() => {
        manager.dispose();
    });
    it('should create and retrieve atlases by name', () => {
        const atlas1 = manager.getAtlas('sprites');
        const atlas2 = manager.getAtlas('ui');
        const atlas1Again = manager.getAtlas('sprites');
        expect(atlas1).toBe(atlas1Again);
        expect(atlas1).not.toBe(atlas2);
    });
    it('should add entries to specific atlases', () => {
        const canvas = createMockCanvas(32, 32);
        const entry = manager.addToAtlas('test-atlas', 'test-sprite', canvas);
        expect(entry).not.toBeNull();
        expect(entry.key).toBe('test-sprite');
        // Verify it's in the correct atlas
        const atlas = manager.getAtlas('test-atlas');
        const retrievedEntry = atlas.getEntry('test-sprite');
        expect(retrievedEntry).toBe(entry);
    });
    it('should find entries across atlases', () => {
        const canvas1 = createMockCanvas(32, 32);
        const canvas2 = createMockCanvas(48, 48);
        manager.addToAtlas('atlas1', 'sprite1', canvas1);
        manager.addToAtlas('atlas2', 'sprite2', canvas2);
        const result1 = manager.findEntry('sprite1');
        const result2 = manager.findEntry('sprite2');
        const result3 = manager.findEntry('nonexistent');
        expect(result1).not.toBeNull();
        expect(result1.entry.key).toBe('sprite1');
        expect(result2).not.toBeNull();
        expect(result2.entry.key).toBe('sprite2');
        expect(result3).toBeNull();
    });
    it('should provide global statistics', () => {
        const canvas = createMockCanvas(32, 32);
        manager.addToAtlas('atlas1', 'sprite1', canvas);
        manager.addToAtlas('atlas1', 'sprite2', canvas);
        manager.addToAtlas('atlas2', 'sprite3', canvas);
        const stats = manager.getGlobalStats();
        expect(stats.atlasCount).toBe(2);
        expect(stats.totalEntries).toBe(3);
        expect(stats.averageUtilization).toBeGreaterThan(0);
    });
    it('should handle empty state statistics', () => {
        const stats = manager.getGlobalStats();
        expect(stats.atlasCount).toBe(0);
        expect(stats.totalEntries).toBe(0);
        expect(stats.averageUtilization).toBe(0);
    });
});
