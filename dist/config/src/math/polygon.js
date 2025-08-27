// polygon.ts
// Polygon math utilities for hull/collision logic
// See svg-hull-implementation-plan.md for requirements
export function pointInPolygon(point, polygon) {
    // Raycast algorithm (even-odd rule)
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (((yi > point[1]) !== (yj > point[1])) &&
            (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi + 1e-12) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}
export function distancePointToSegment(point, segA, segB) {
    // Compute distance from point to segment AB
    const [px, py] = point;
    const [ax, ay] = segA;
    const [bx, by] = segB;
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0)
        return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const projX = ax + t * dx, projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
}
export function circleIntersectsPolygon(center, radius, polygon) {
    // Check if circle intersects polygon edges or is inside polygon
    if (pointInPolygon(center, polygon))
        return true;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (distancePointToSegment(center, polygon[j], polygon[i]) <= radius)
            return true;
    }
    return false;
}
// Ramer–Douglas–Peucker simplification
export function polygonSimplify(points, tolerance) {
    if (points.length < 3)
        return points;
    const sqTolerance = tolerance * tolerance;
    function getSqDist(p1, p2) {
        const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
        return dx * dx + dy * dy;
    }
    function getSqSegDist(p, a, b) {
        const x = a[0], y = a[1];
        const dx = b[0] - x;
        const dy = b[1] - y;
        if (dx === 0 && dy === 0)
            return getSqDist(p, a);
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        if (t <= 0)
            return getSqDist(p, a);
        if (t >= 1)
            return getSqDist(p, b);
        const projX = x + t * dx;
        const projY = y + t * dy;
        const ddx = p[0] - projX;
        const ddy = p[1] - projY;
        return ddx * ddx + ddy * ddy;
    }
    function simplifyDP(start, end, out) {
        let maxDist = 0, index = -1;
        for (let i = start + 1; i < end; i++) {
            const dist = getSqSegDist(points[i], points[start], points[end]);
            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }
        if (maxDist > sqTolerance && index !== -1) {
            simplifyDP(start, index, out);
            simplifyDP(index, end, out);
        }
        else {
            out.push(start);
        }
    }
    const out = [];
    simplifyDP(0, points.length - 1, out);
    out.push(points.length - 1);
    // map indices to points
    return out.map(i => points[i]);
}
// Optional: triangulate via earcut (not implemented)
// export function triangulate(polygon: [number, number][]): number[][] {
//   // TODO: Use earcut or similar
//   return [];
// }
