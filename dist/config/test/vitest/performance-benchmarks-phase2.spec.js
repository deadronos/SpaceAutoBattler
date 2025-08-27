/**
 * Performance benchmarks for Phase 2 instanced rendering
 * Tests performance gains from instanced rendering vs individual draws
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstancedRenderer } from '../../src/webgl/instancedRenderer';
import { AtlasManager } from '../../src/assets/textureAtlas';
// Mock high-resolution timer for consistent benchmarking
const mockPerformanceNow = () => {
    let time = 0;
    return () => time += Math.random() * 0.1 + 0.05; // Simulate 0.05-0.15ms operations
};
// Mock WebGL context optimized for benchmarking
class BenchmarkWebGLContext {
    static VERTEX_SHADER = 0x8B31;
    static FRAGMENT_SHADER = 0x8B30;
    static COMPILE_STATUS = 0x8B81;
    static LINK_STATUS = 0x8B82;
    static TRIANGLES = 0x0004;
    static FLOAT = 0x1406;
    static ARRAY_BUFFER = 0x8892;
    static DYNAMIC_DRAW = 0x88E8;
    static TEXTURE_2D = 0x0DE1;
    static RGBA = 0x1908;
    static UNSIGNED_BYTE = 0x1401;
    callCounts = new Map();
    performanceNow = mockPerformanceNow();
    // Track method call counts for performance analysis
    trackCall(method) {
        const current = this.callCounts.get(method) || 0;
        this.callCounts.set(method, current + 1);
    }
    getCallCount(method) {
        return this.callCounts.get(method) || 0;
    }
    resetCallCounts() {
        this.callCounts.clear();
    }
    // Mock WebGL methods with call tracking
    createShader(type) {
        this.trackCall('createShader');
        return { id: Math.random(), type, compiled: true };
    }
    createProgram() {
        this.trackCall('createProgram');
        return { id: Math.random(), linked: true };
    }
    createBuffer() {
        this.trackCall('createBuffer');
        return { id: Math.random() };
    }
    createTexture() {
        this.trackCall('createTexture');
        return { id: Math.random() };
    }
    createVertexArray() {
        this.trackCall('createVertexArray');
        return { id: Math.random() };
    }
    drawArraysInstanced(mode, first, count, instanceCount) {
        this.trackCall('drawArraysInstanced');
        // Simulate GPU work proportional to instance count
        const workTime = instanceCount * 0.001;
        this.performanceNow(); // Advance time
    }
    drawArrays(mode, first, count) {
        this.trackCall('drawArrays');
        this.performanceNow(); // Advance time
    }
    useProgram(program) {
        this.trackCall('useProgram');
    }
    bindTexture(target, texture) {
        this.trackCall('bindTexture');
    }
    bufferData(target, data, usage) {
        this.trackCall('bufferData');
    }
    // Standard mock methods (no tracking needed)
    shaderSource() { }
    compileShader() { }
    getShaderParameter() { return true; }
    getShaderInfoLog() { return ''; }
    attachShader() { }
    linkProgram() { }
    getProgramParameter() { return true; }
    getProgramInfoLog() { return ''; }
    getAttribLocation(program, name) {
        const locations = {
            'aPosition': 0, 'aUV': 1, 'aInstanceTransform': 2, 'aInstanceUV': 3, 'aInstanceTint': 4
        };
        return locations[name] ?? -1;
    }
    getUniformLocation() { return { location: Math.random() }; }
    deleteShader() { }
    deleteProgram() { }
    deleteBuffer() { }
    deleteTexture() { }
    deleteVertexArray() { }
    bindBuffer() { }
    enableVertexAttribArray() { }
    vertexAttribPointer() { }
    vertexAttribDivisor() { }
    bindVertexArray() { }
    uniformMatrix4fv() { }
    uniform1i() { }
    activeTexture() { }
    enable() { }
    blendFunc() { }
    texImage2D() { }
    texParameteri() { }
    generateMipmap() { }
    pixelStorei() { }
    getExtension() { return null; }
}
function benchmark(name, fn, iterations = 100) {
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    return {
        name,
        averageTime: totalTime / iterations,
        totalTime,
        iterations,
        callCounts: {}
    };
}
function generateInstanceData(count) {
    const instances = [];
    for (let i = 0; i < count; i++) {
        instances.push({
            x: Math.random() * 800,
            y: Math.random() * 600,
            rotation: Math.random() * Math.PI * 2,
            scaleX: 0.5 + Math.random() * 1.5,
            scaleY: 0.5 + Math.random() * 1.5,
            uvX: Math.random() * 0.5,
            uvY: Math.random() * 0.5,
            uvWidth: 0.25 + Math.random() * 0.25,
            uvHeight: 0.25 + Math.random() * 0.25,
            tintR: 0.7 + Math.random() * 0.3,
            tintG: 0.7 + Math.random() * 0.3,
            tintB: 0.7 + Math.random() * 0.3,
            alpha: 0.8 + Math.random() * 0.2
        });
    }
    return instances;
}
describe('Performance Benchmarks - Phase 2 Instanced Rendering', () => {
    let mockGl;
    let renderer;
    let atlasManager;
    beforeEach(() => {
        mockGl = new BenchmarkWebGLContext();
        renderer = new InstancedRenderer(mockGl);
        renderer.init();
        atlasManager = new AtlasManager(mockGl, {
            maxAtlasSize: 1024,
            padding: 1
        });
    });
    afterEach(() => {
        renderer.dispose();
        atlasManager.dispose();
    });
    it('should measure instanced rendering performance vs traditional draws', () => {
        const instanceCounts = [10, 50, 100, 500, 1000];
        const results = {};
        for (const count of instanceCounts) {
            const instances = generateInstanceData(count);
            const texture = mockGl.createTexture();
            const projectionMatrix = new Float32Array(16);
            // Benchmark instanced rendering
            mockGl.resetCallCounts();
            const instancedResult = benchmark(`Instanced Rendering (${count} instances)`, () => {
                const batch = { texture, instances, blendMode: 'normal' };
                renderer.renderBatch(batch, projectionMatrix);
            }, 50);
            instancedResult.callCounts = {
                drawArraysInstanced: mockGl.getCallCount('drawArraysInstanced'),
                useProgram: mockGl.getCallCount('useProgram'),
                bindTexture: mockGl.getCallCount('bindTexture'),
                bufferData: mockGl.getCallCount('bufferData')
            };
            // Benchmark traditional individual draws
            mockGl.resetCallCounts();
            const traditionalResult = benchmark(`Traditional Rendering (${count} draws)`, () => {
                for (let i = 0; i < count; i++) {
                    // Simulate individual draw calls
                    mockGl.useProgram(null);
                    mockGl.bindTexture(BenchmarkWebGLContext.TEXTURE_2D, texture);
                    mockGl.drawArrays(BenchmarkWebGLContext.TRIANGLES, 0, 6);
                }
            }, 50);
            traditionalResult.callCounts = {
                drawArrays: mockGl.getCallCount('drawArrays'),
                useProgram: mockGl.getCallCount('useProgram'),
                bindTexture: mockGl.getCallCount('bindTexture')
            };
            results[count] = { instanced: instancedResult, traditional: traditionalResult };
            // Log results for analysis
            console.log(`\\n--- ${count} Instances ---`);
            console.log(`Instanced: ${instancedResult.averageTime.toFixed(3)}ms avg, ${instancedResult.callCounts.drawArraysInstanced} draw calls`);
            console.log(`Traditional: ${traditionalResult.averageTime.toFixed(3)}ms avg, ${traditionalResult.callCounts.drawArrays} draw calls`);
            console.log(`Speedup: ${(traditionalResult.averageTime / instancedResult.averageTime).toFixed(2)}x`);
        }
        // Verify performance characteristics
        for (const count of instanceCounts) {
            const { instanced, traditional } = results[count];
            // Instanced rendering should use significantly fewer draw calls
            expect(instanced.callCounts.drawArraysInstanced).toBeLessThanOrEqual(10); // Should batch efficiently
            expect(traditional.callCounts.drawArrays).toBe(count * 50); // One call per sprite per iteration
            // For larger sprite counts, instanced should be faster
            if (count >= 100) {
                expect(instanced.averageTime).toBeLessThan(traditional.averageTime);
            }
        }
    });
    it('should measure texture atlas packing performance', () => {
        const atlas = atlasManager.getAtlas('benchmark');
        const entryCounts = [10, 25, 50, 100];
        for (const count of entryCounts) {
            const canvases = Array.from({ length: count }, (_, i) => {
                const canvas = document.createElement('canvas');
                canvas.width = 32 + (i % 3) * 16; // Vary sizes
                canvas.height = 32 + (i % 3) * 16;
                return canvas;
            });
            const result = benchmark(`Atlas Packing (${count} entries)`, () => {
                atlas.clear(); // Reset for each iteration
                canvases.forEach((canvas, i) => {
                    atlas.addEntry(`sprite-${i}`, canvas);
                });
            }, 20);
            console.log(`\\nAtlas Packing (${count} entries): ${result.averageTime.toFixed(3)}ms avg`);
            // Verify atlas utilization
            const stats = atlas.getStats();
            expect(stats.entryCount).toBe(count);
            expect(stats.utilization).toBeGreaterThan(0);
            // Packing should scale reasonably
            expect(result.averageTime).toBeLessThan(count * 0.5); // Less than 0.5ms per entry
        }
    });
    it('should measure batch grouping efficiency', () => {
        const spriteCount = 1000;
        const textureCount = 5;
        // Create multiple textures
        const textures = Array.from({ length: textureCount }, () => mockGl.createTexture());
        // Generate sprites distributed across textures
        const sprites = Array.from({ length: spriteCount }, (_, i) => ({
            texture: textures[i % textureCount],
            instance: generateInstanceData(1)[0]
        }));
        const projectionMatrix = new Float32Array(16);
        // Benchmark batch grouping and rendering
        mockGl.resetCallCounts();
        const result = benchmark('Batch Grouping and Rendering', () => {
            // Group by texture (simulating real batching logic)
            const batches = new Map();
            for (const sprite of sprites) {
                if (!batches.has(sprite.texture)) {
                    batches.set(sprite.texture, []);
                }
                batches.get(sprite.texture).push(sprite.instance);
            }
            // Render each batch
            for (const [texture, instances] of batches) {
                const batch = { texture, instances, blendMode: 'normal' };
                renderer.renderBatch(batch, projectionMatrix);
            }
        }, 30);
        console.log(`\\nBatch Grouping (${spriteCount} sprites, ${textureCount} textures):`);
        console.log(`Average time: ${result.averageTime.toFixed(3)}ms`);
        console.log(`Draw calls: ${mockGl.getCallCount('drawArraysInstanced')}`);
        console.log(`Texture binds: ${mockGl.getCallCount('bindTexture')}`);
        // Should have one draw call per texture
        expect(mockGl.getCallCount('drawArraysInstanced')).toBe(textureCount * result.iterations);
        // Should be efficient for large sprite counts
        expect(result.averageTime).toBeLessThan(50); // Less than 50ms for 1000 sprites
    });
    it('should validate memory usage patterns', () => {
        const largeInstanceCount = 2000;
        const instances = generateInstanceData(largeInstanceCount);
        const texture = mockGl.createTexture();
        const projectionMatrix = new Float32Array(16);
        // Test memory-efficient batching
        const maxBatchSize = 1000; // Simulated limit
        const batches = [];
        for (let i = 0; i < instances.length; i += maxBatchSize) {
            const batchInstances = instances.slice(i, i + maxBatchSize);
            batches.push({
                texture,
                instances: batchInstances,
                blendMode: 'normal'
            });
        }
        mockGl.resetCallCounts();
        const result = benchmark('Large Dataset Batching', () => {
            for (const batch of batches) {
                renderer.renderBatch(batch, projectionMatrix);
            }
        }, 10);
        console.log(`\\nLarge Dataset (${largeInstanceCount} instances):`);
        console.log(`Batches: ${batches.length}`);
        console.log(`Average time: ${result.averageTime.toFixed(3)}ms`);
        console.log(`Draw calls per frame: ${mockGl.getCallCount('drawArraysInstanced') / result.iterations}`);
        // Should handle large datasets efficiently
        expect(batches.length).toBe(Math.ceil(largeInstanceCount / maxBatchSize));
        expect(result.averageTime).toBeLessThan(200); // Less than 200ms for 2000 sprites
    });
    it('should compare Phase 1 vs Phase 2 performance characteristics', () => {
        // This test compares the enhanced features from both phases
        const spriteCount = 500;
        const instances = generateInstanceData(spriteCount);
        console.log('\\n=== Phase 1 vs Phase 2 Performance Comparison ===');
        // Phase 2: Instanced rendering with atlas
        const atlas = atlasManager.getAtlas('comparison');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        atlas.addEntry('test-sprite', canvas);
        const texture = atlas.getTexture();
        const projectionMatrix = new Float32Array(16);
        mockGl.resetCallCounts();
        const phase2Result = benchmark('Phase 2 (Instanced + Atlas)', () => {
            const batch = { texture, instances, blendMode: 'normal' };
            renderer.renderBatch(batch, projectionMatrix);
        }, 50);
        // Phase 1: Enhanced SVG rendering (simulated)
        const phase1Result = benchmark('Phase 1 (Enhanced SVG)', () => {
            // Simulate Phase 1 individual sprite processing with worker + cache
            for (let i = 0; i < spriteCount; i++) {
                // Simulate cache lookup, worker processing, WebGL texture upload
                mockGl.createTexture();
                mockGl.bindTexture(BenchmarkWebGLContext.TEXTURE_2D, null);
                mockGl.drawArrays(BenchmarkWebGLContext.TRIANGLES, 0, 6);
            }
        }, 10); // Fewer iterations due to higher cost
        console.log(`Phase 1 (Enhanced SVG): ${phase1Result.averageTime.toFixed(3)}ms avg`);
        console.log(`Phase 2 (Instanced + Atlas): ${phase2Result.averageTime.toFixed(3)}ms avg`);
        console.log(`Phase 2 Speedup: ${(phase1Result.averageTime / phase2Result.averageTime).toFixed(2)}x`);
        // Phase 2 should show significant performance improvement
        expect(phase2Result.averageTime).toBeLessThan(phase1Result.averageTime);
        // Phase 2 should use far fewer GL calls
        expect(mockGl.getCallCount('drawArraysInstanced')).toBeLessThan(mockGl.getCallCount('drawArrays'));
    });
});
describe('Scalability Analysis', () => {
    it('should analyze performance scaling characteristics', () => {
        console.log('\\n=== Scalability Analysis ===');
        const mockGl = new BenchmarkWebGLContext();
        const renderer = new InstancedRenderer(mockGl);
        renderer.init();
        const scalingPoints = [10, 50, 100, 500, 1000, 2000, 5000];
        const results = [];
        for (const count of scalingPoints) {
            const instances = generateInstanceData(count);
            const texture = mockGl.createTexture();
            const projectionMatrix = new Float32Array(16);
            const result = benchmark(`Scaling Test (${count})`, () => {
                const batch = { texture, instances, blendMode: 'normal' };
                renderer.renderBatch(batch, projectionMatrix);
            }, 20);
            const efficiency = count / result.averageTime; // Sprites per ms
            results.push({ count, timeMs: result.averageTime, efficiency });
            console.log(`${count} sprites: ${result.averageTime.toFixed(3)}ms (${efficiency.toFixed(1)} sprites/ms)`);
        }
        // Analyze scaling pattern
        const firstEfficiency = results[0].efficiency;
        const lastEfficiency = results[results.length - 1].efficiency;
        console.log(`\\nEfficiency change: ${firstEfficiency.toFixed(1)} → ${lastEfficiency.toFixed(1)} sprites/ms`);
        console.log(`Scaling factor: ${(lastEfficiency / firstEfficiency).toFixed(2)}x`);
        // Instanced rendering should scale well (efficiency shouldn't degrade too much)
        expect(lastEfficiency).toBeGreaterThan(firstEfficiency * 0.5); // At least 50% efficiency retained
        renderer.dispose();
    });
});
