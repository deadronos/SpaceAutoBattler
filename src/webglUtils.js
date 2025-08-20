// Small helper utilities for WebGL renderer
// - splitIndicesForDraw(verticesCount): returns array of {startVertex, vertexCount}

export function supportsUint32Indices(gl) {
  if (!gl) return false;
  // WebGL2 has native uint32 element support
  if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) return true;
  // WebGL1: check for extension
  try {
    return !!gl.getExtension('OES_element_index_uint');
  } catch (e) {
    return false;
  }
}

export function splitVertexRanges(totalVertices, maxVerticesPerDraw = 65535) {
  // Return array of ranges: {start, count}
  if (totalVertices <= 0) return [];
  const ranges = [];
  let remaining = totalVertices;
  let offset = 0;
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxVerticesPerDraw);
    ranges.push({ start: offset, count: chunk });
    offset += chunk;
    remaining -= chunk;
  }
  return ranges;
}
