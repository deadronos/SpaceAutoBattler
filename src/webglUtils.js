// Small helper utilities for WebGL renderer
// - splitIndicesForDraw(verticesCount): returns array of {startVertex, vertexCount}

export function supportsUint32Indices(gl) {
  if (!gl) return false;
  if (gl instanceof WebGL2RenderingContext) return true;
  try {
    return !!gl.getExtension('OES_element_index_uint');
  } catch {
    return false;
  }
}

export function splitVertexRanges(totalVertices, maxVerticesPerDraw = 65535) {
  if (totalVertices <= 0) return [];
  const ranges = [];
  let offset = 0;
  while (totalVertices > 0) {
    const count = Math.min(totalVertices, maxVerticesPerDraw);
    ranges.push({ start: offset, count });
    offset += count;
    totalVertices -= count;
  }
  return ranges;
}
