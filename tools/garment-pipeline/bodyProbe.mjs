// Independent clipping check against the REAL body mesh.
//
// The drape report was measuring penetration with the same radial field the
// solver uses to prevent it -- the field said 1% while the render clearly
// showed the shirt sunk into the chest. A check has to use different evidence
// than the thing it is checking, so this one ignores the field entirely and
// works off the body's own 14.5k vertices and their normals.
//
// Nearest-vertex rather than nearest-triangle: body vertex spacing is about
// 1 cm, well under the penetration depths that matter here, and a triangle
// BVH would be a lot of machinery for the same answer.

/** Vertex normals of the deformed body, area-weighted from its triangles. */
export function computeVertexNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ax = positions[b] - positions[a];
    const ay = positions[b + 1] - positions[a + 1];
    const az = positions[b + 2] - positions[a + 2];
    const bx = positions[c] - positions[a];
    const by = positions[c + 1] - positions[a + 1];
    const bz = positions[c + 2] - positions[a + 2];
    // Cross product magnitude is twice the area, so leaving it unnormalised
    // area-weights the accumulation for free.
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= len;
    normals[v + 1] /= len;
    normals[v + 2] /= len;
  }
  return normals;
}

/** Uniform spatial hash over the body vertices. */
export function buildBodyGrid(positions, cell = 0.03) {
  const map = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  for (let v = 0; v < positions.length / 3; v++) {
    const i = Math.floor(positions[v * 3] / cell);
    const j = Math.floor(positions[v * 3 + 1] / cell);
    const k = Math.floor(positions[v * 3 + 2] / cell);
    const kk = key(i, j, k);
    let bucket = map.get(kk);
    if (!bucket) map.set(kk, (bucket = []));
    bucket.push(v);
  }
  return { map, cell, positions, key };
}

/**
 * Signed distance from a point to the body surface: negative means inside.
 * Returns null when nothing is near enough to judge.
 */
export function signedDistance(grid, normals, px, py, pz, searchCells = 2) {
  const { map, cell, positions, key } = grid;
  const ci = Math.floor(px / cell);
  const cj = Math.floor(py / cell);
  const ck = Math.floor(pz / cell);

  let best = -1;
  let bestD2 = Infinity;
  for (let i = ci - searchCells; i <= ci + searchCells; i++) {
    for (let j = cj - searchCells; j <= cj + searchCells; j++) {
      for (let k = ck - searchCells; k <= ck + searchCells; k++) {
        const bucket = map.get(key(i, j, k));
        if (!bucket) continue;
        for (const v of bucket) {
          const dx = px - positions[v * 3];
          const dy = py - positions[v * 3 + 1];
          const dz = pz - positions[v * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = v;
          }
        }
      }
    }
  }
  if (best < 0) return null;

  const dx = px - positions[best * 3];
  const dy = py - positions[best * 3 + 1];
  const dz = pz - positions[best * 3 + 2];
  return dx * normals[best * 3] + dy * normals[best * 3 + 1] + dz * normals[best * 3 + 2];
}
