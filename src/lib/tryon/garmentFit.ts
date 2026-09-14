/**
 * Fitting a real-sized garment mesh onto the morphed body -- "ep mesh".
 *
 * Two things happen here, and keeping them SEPARATE is the whole point:
 *
 *  1. The fit VERDICT (chat / vua / rong) is pure arithmetic: garment
 *     circumference (known exactly from the size chart) minus body
 *     circumference (known exactly from avatarMorphService.measure()). That
 *     difference is "ease", the standard apparel measure. No simulation is
 *     involved, so the number cannot drift with solver tuning.
 *
 *  2. The VISUAL is a Verlet cloth solve: gravity, structural and bending
 *     constraints, fabric stretch limits, collision against the body. It shows
 *     WHERE the garment is tight; it never feeds back into the verdict.
 *
 * Why not bind the garment to the body (MakeHuman .mhclo proxy fitting):
 * binding makes the garment follow the skin exactly, so every size looks
 * identical and the size signal -- the one thing this feature exists to show
 * -- is destroyed.
 *
 * Collision, and why it looks like this: the body used to be approximated by a
 * cylindrical radius field around the torso axis. Cheap, but it cannot
 * represent arms or legs at all. An independent check against the real body
 * mesh (tools/garment-pipeline/bodyProbe.mjs) found 24-39% of the garment
 * buried up to 9.6 cm inside the body while the field itself reported 1-4% and
 * 2 cm -- it was under-reporting by 5x in depth and 10x in area, because a
 * collider that cannot see an arm cannot report a sleeve sunk into one. The
 * field and the arm capsules are gone; collision runs against the body's own
 * vertices now, so arms, legs and shoulders all work for free.
 */
import type { MorphRig } from '../avatar/avatarMorphService';

// Type-only import on purpose: this module has no runtime dependencies, so it
// runs unchanged in the browser and under `node --experimental-strip-types`.

// --- Deformed body positions -------------------------------------------------

/** All vertex positions with the given morph influences applied. */
export function deformPositions(rig: MorphRig, influences: Float32Array): Float32Array {
  const out = new Float32Array(rig.position);
  for (let m = 0; m < influences.length; m++) {
    const inf = influences[m];
    if (inf === 0) continue;
    const d = rig.morphDeltas[m];
    for (let i = 0; i < out.length; i++) out[i] += d[i] * inf;
  }
  return out;
}

// --- Body collider -----------------------------------------------------------

/**
 * Slack every tether gets on top of the fabric's percentage, metres.
 *
 * Replaces a minimum span below which tethers were skipped entirely. The
 * percentage alone is useless close to the anchor -- 3% of a 12 cm geodesic is
 * 4 mm of freedom and the shoulder yoke needs about 3 cm -- so the tether was
 * switched off below 20 cm. But switching a constraint on at a fixed geodesic
 * distance draws a RING on the garment: inside it the knit stretched up to its
 * 20% limit under the shirt's own weight, at it the tether clamped hard, and
 * the material piled up against the boundary as a fold across the chest. On a
 * front neckline that dips, the ring is U-shaped, which is exactly how it
 * looked. Switching to woven made it vanish -- 3% cannot stretch enough to pile
 * up -- which is what pointed here.
 *
 * A fixed allowance added to the percentage gives short chains the centimetres
 * they need without any threshold, so nothing switches on anywhere.
 */
const TETHER_FREE_SLACK = 0.015;

/** How far a collar vertex is pulled toward its neighbours per smoothing pass. */
const COLLAR_SMOOTHING = 0.4;

/** Shorter than this and an edge is decimation debris, not fabric (metres). */
const MIN_EDGE_LENGTH = 0.003;

// Subsampling large triangles at their edge midpoints was tried here and
// removed: it doubled the solve time and changed nothing, which is also how it
// became clear the remaining shoulder gap is not a sampling-density problem.

/** Cell index offset, so hashed coordinates stay non-negative for bodies at y>0. */
const GRID_BIAS = 256;

/**
 * The body as a point cloud with normals in a uniform spatial hash.
 *
 * Nearest-vertex rather than nearest-triangle: body vertex spacing is about
 * 1 cm, an order of magnitude finer than the penetrations that matter here,
 * and a triangle BVH is a lot of machinery for the same answer.
 */
export interface BodyCollider {
  positions: Float32Array;
  normals: Float32Array;
  cell: number;
  buckets: Map<number, Int32Array>;
  /** Y of the shoulder line -- where a top hangs from. */
  shoulderY: number;
  /** Y of the waist ring -- where trousers hang from. */
  waistY: number;
  /** Z of the torso axis at chest height; the chest sits forward of the back. */
  axisZ: number;
  /** Body rotation about Y, radians, matching THREE's object.rotation.y. */
  yaw?: number;
}

function hashKey(i: number, j: number, k: number): number {
  return ((i + GRID_BIAS) * 512 + (j + GRID_BIAS)) * 512 + (k + GRID_BIAS);
}

/** Area-weighted vertex normals of the deformed body. */
function bodyNormals(positions: Float32Array, indices: ArrayLike<number>): Float32Array {
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
    // Left unnormalised, so accumulation is area-weighted for free.
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len =
      Math.sqrt(
        normals[v] * normals[v] +
          normals[v + 1] * normals[v + 1] +
          normals[v + 2] * normals[v + 2],
      ) || 1;
    normals[v] /= len;
    normals[v + 1] /= len;
    normals[v + 2] /= len;
  }
  return normals;
}

export function buildBodyCollider(
  rig: MorphRig,
  influences: Float32Array,
  indices: ArrayLike<number>,
  cell = 0.05,
): BodyCollider {
  const positions = deformPositions(rig, influences);
  const normals = bodyNormals(positions, indices);

  const n = positions.length / 3;
  const keys = new Int32Array(n);
  const counts = new Map<number, number>();
  for (let v = 0; v < n; v++) {
    const key = hashKey(
      Math.floor(positions[v * 3] / cell),
      Math.floor(positions[v * 3 + 1] / cell),
      Math.floor(positions[v * 3 + 2] / cell),
    );
    keys[v] = key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const buckets = new Map<number, Int32Array>();
  for (const [key, count] of counts) buckets.set(key, new Int32Array(count));
  const fill = new Map<number, number>();
  for (let v = 0; v < n; v++) {
    const key = keys[v];
    const at = fill.get(key) ?? 0;
    buckets.get(key)![at] = v;
    fill.set(key, at + 1);
  }

  const yOf = (v: number) => positions[v * 3 + 1];
  const shoulderY = (yOf(rig.landmarks.acromionLeft) + yOf(rig.landmarks.acromionRight)) / 2;

  let axisZ = 0;
  const chest = rig.rings.chest;
  for (const v of chest) axisZ += positions[v * 3 + 2];
  axisZ = chest.length ? axisZ / chest.length : 0;

  const waist = rig.rings.waist;
  let waistY = shoulderY - 0.42;
  if (waist && waist.length) {
    let s = 0;
    for (const v of waist) s += positions[v * 3 + 1];
    waistY = s / waist.length;
  }

  return { positions, normals, cell, buckets, shoulderY, waistY, axisZ };
}

/**
 * How many nearby body vertices each cloth vertex is resolved against.
 *
 * One. Three was tried, on the theory that a vertex pinched between the arm
 * and the torso needs both surfaces to push it. It barely moved the number it
 * was aimed at (1.02 -> 0.98 cm) and it made the solver diverge: in a pinch
 * the candidates push in opposing directions, each projecting fully, and the
 * vertex gets batted back and forth until it is flung far from its neighbours
 * -- edges reached ten times their rest length against a fabric cap of 1.2.
 * The real fix for that clipping was the ordering of the cap and collision
 * passes, not the candidate count.
 */
const COLLIDER_CANDIDATES = 1;

/** Corner clearance above which a triangle cannot be hiding a pokethrough. */
const FACE_SKIP_GAP = 0.02;

/** Steps of thorough stretch-cap convergence run at the end of a settle. */
export const CAP_FINISH_STEPS = 8;

/**
 * The nearest body vertices to a point in BODY-LOCAL space, closest first.
 * Writes into `out` and returns how many were found.
 */
function nearestBodyVertices(
  collider: BodyCollider,
  x: number,
  y: number,
  z: number,
  out: Int32Array,
  outOffset: number,
): number {
  const { cell, buckets, positions } = collider;
  const ci = Math.floor(x / cell);
  const cj = Math.floor(y / cell);
  const ck = Math.floor(z / cell);

  const bestV = [-1, -1, -1];
  const bestD = [Infinity, Infinity, Infinity];

  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let k = ck - 1; k <= ck + 1; k++) {
        const bucket = buckets.get(hashKey(i, j, k));
        if (bucket === undefined) continue;
        for (let b = 0; b < bucket.length; b++) {
          const v = bucket[b];
          const dx = x - positions[v * 3];
          const dy = y - positions[v * 3 + 1];
          const dz = z - positions[v * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= bestD[COLLIDER_CANDIDATES - 1]) continue;
          let slot = COLLIDER_CANDIDATES - 1;
          while (slot > 0 && d2 < bestD[slot - 1]) {
            bestD[slot] = bestD[slot - 1];
            bestV[slot] = bestV[slot - 1];
            slot--;
          }
          bestD[slot] = d2;
          bestV[slot] = v;
        }
      }
    }
  }

  let found = 0;
  for (let c = 0; c < COLLIDER_CANDIDATES; c++) {
    out[outOffset + c] = bestV[c];
    if (bestV[c] >= 0) found++;
  }
  return found;
}

/** Nearest body vertex only -- used by the placement and reporting paths. */
function nearestBodyVertex(collider: BodyCollider, x: number, y: number, z: number): number {
  const tmp = new Int32Array(COLLIDER_CANDIDATES);
  nearestBodyVertices(collider, x, y, z, tmp, 0);
  return tmp[0];
}

/** Signed distance to the body along the nearest vertex normal; < 0 is inside. */
export function signedDistanceToBody(
  collider: BodyCollider,
  x: number,
  y: number,
  z: number,
): number | null {
  const v = nearestBodyVertex(collider, x, y, z);
  if (v < 0) return null;
  const { positions, normals } = collider;
  return (
    (x - positions[v * 3]) * normals[v * 3] +
    (y - positions[v * 3 + 1]) * normals[v * 3 + 1] +
    (z - positions[v * 3 + 2]) * normals[v * 3 + 2]
  );
}

// --- Ease / verdict ----------------------------------------------------------

export type FitVerdict = 'chat' | 'vua' | 'rong';

/**
 * Wearing ease thresholds for a knit tee, in cm of circumference. Apparel
 * convention, not solver output.
 */
export const EASE_MIN_CM = 5;
export const EASE_MAX_CM = 13;

export function verdictForEase(easeCm: number): FitVerdict {
  if (easeCm < EASE_MIN_CM) return 'chat';
  if (easeCm > EASE_MAX_CM) return 'rong';
  return 'vua';
}

// --- Garment description -----------------------------------------------------

/** Region ids, must match REGION in tools/garment-pipeline/build_garment_glb.py. */
export const GARMENT_REGION = {
  torsoFront: 0,
  torsoBack: 1,
  sideSeam: 2,
  hem: 3,
  yoke: 4,
  collar: 5,
  sleeveRight: 6,
  sleeveLeft: 7,
  cuffRight: 8,
  cuffLeft: 9,
} as const;

export interface Fabric {
  /**
   * Hard cap on edge length as a multiple of rest length, under LOAD -- i.e.
   * when a body is pressing the cloth outward.
   */
  maxStretch: number;
  /**
   * Cap on how far a vertex may drift from its anchor under its own weight.
   *
   * Separate from maxStretch on purpose. Using the load limit here let the
   * shirt elongate the full 20% from gravity alone and the hem sat 18 cm low,
   * around knee height. Real knit barely creeps under self-weight; it only
   * reaches its stretch limit when something pushes it there.
   */
  tetherSlack: number;
  /** How strongly the cloth pulls back toward rest when stretched, 0..1. */
  stretchStiffness: number;
  /** Resistance to buckling; near zero lets fabric fold freely. */
  compressStiffness: number;
  /** Resistance to bending -- sets how large the folds are. */
  bendStiffness: number;
  /** Velocity retained per step. */
  damping: number;
}

/** Knit stretches and drapes softly; woven holds its shape; denim barely moves. */
export const FABRICS: Record<'knit' | 'woven' | 'denim', Fabric> = {
  knit: {
    maxStretch: 1.2, tetherSlack: 1.03, stretchStiffness: 0.7,
    compressStiffness: 0.02, bendStiffness: 0.05, damping: 0.97,
  },
  woven: {
    maxStretch: 1.03, tetherSlack: 1.01, stretchStiffness: 0.85,
    compressStiffness: 0.04, bendStiffness: 0.18, damping: 0.96,
  },
  denim: {
    maxStretch: 1.01, tetherSlack: 1.005, stretchStiffness: 0.95,
    compressStiffness: 0.08, bendStiffness: 0.4, damping: 0.94,
  },
};

export interface GarmentGeometry {
  /** Local positions, y = 0 at the shoulder line, hem at negative y, front +Z. */
  positions: Float32Array;
  indices: Uint32Array;
  /** Per-vertex region id from the `_REGION` attribute. */
  regions: Uint8Array;
  /** Original planar UV for the fabric weave. */
  uv?: Float32Array;
  /** Rest-pose panel UV for artwork, independent of the fabric weave. */
  artUv?: Float32Array;
  /**
   * Per-vertex front/back weight from the `_FACING` attribute, 1 = front.
   *
   * Baked at build time from the REST normal, not recomputed per frame: the
   * print has to stay stuck to the threads, and a facing weight taken from the
   * deforming normal would let it slide across the fabric as the cloth moves.
   */
  facing?: Float32Array;
}

export interface GarmentConstraints {
  /** Structural edge pairs, flat [a0,b0, a1,b1, ...]. */
  edges: Uint32Array;
  restLengths: Float32Array;
  /** Bend pairs: the two vertices opposite a shared edge. */
  bendPairs: Uint32Array;
  bendRest: Float32Array;
}

/**
 * Structural edges plus bend pairs. Build once per size and reuse.
 *
 * `seams` are (sleeve vertex, torso vertex) pairs emitted by the pipeline.
 * They are the stitching: without them the sleeves are separate shells with no
 * path along the cloth back to the collar, the long-range attachments never
 * reach them, and they slide down the arm and drop off the model entirely.
 */
export function buildConstraints(
  geom: GarmentGeometry,
  seams: ReadonlyArray<readonly [number, number]> = [],
): GarmentConstraints {
  const { indices, positions } = geom;
  const edgeSeen = new Map<number, number>(); // edge key -> opposite vertex of first triangle
  const edgeList: number[] = [];
  const bendList: number[] = [];

  const key = (a: number, b: number) => (a < b ? a : b) * 4294967296 + (a < b ? b : a);

  for (let i = 0; i < indices.length; i += 3) {
    const tri = [indices[i], indices[i + 1], indices[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const opp = tri[(e + 2) % 3];
      const k = key(a, b);
      const seen = edgeSeen.get(k);
      if (seen === undefined) {
        edgeSeen.set(k, opp);
        edgeList.push(Math.min(a, b), Math.max(a, b));
      } else if (seen !== opp) {
        bendList.push(seen, opp);
      }
    }
  }

  for (const [a, b] of seams) {
    const k = key(a, b);
    if (edgeSeen.has(k)) continue;
    edgeSeen.set(k, -1);
    edgeList.push(Math.min(a, b), Math.max(a, b));
  }

  const dist = (a: number, b: number) =>
    Math.hypot(
      positions[a * 3] - positions[b * 3],
      positions[a * 3 + 1] - positions[b * 3 + 1],
      positions[a * 3 + 2] - positions[b * 3 + 2],
    );

  // Edges far shorter than the mesh resolution are dropped.
  //
  // Vertex clustering leaves a few 2 mm edges in a mesh whose typical edge is
  // ~15 mm. They are discretisation debris, not fabric: constraining them adds
  // stiffness that represents nothing, and len/rest on them explodes. Measured
  // on the worst case, the four shortest edges alone accounted for a reported
  // maxStretch of 5.62 against 3.87 for every other edge in the garment.
  const keptEdges: number[] = [];
  const keptRest: number[] = [];
  for (let e = 0; e < edgeList.length / 2; e++) {
    const a = edgeList[e * 2];
    const b = edgeList[e * 2 + 1];
    const d = dist(a, b);
    if (d < MIN_EDGE_LENGTH) continue;
    keptEdges.push(a, b);
    keptRest.push(d);
  }
  const edges = Uint32Array.from(keptEdges);
  const restLengths = Float32Array.from(keptRest);

  const bendPairs = Uint32Array.from(bendList);
  const bendRest = new Float32Array(bendPairs.length / 2);
  for (let e = 0; e < bendRest.length; e++) bendRest[e] = dist(bendPairs[e * 2], bendPairs[e * 2 + 1]);

  return { edges, restLengths, bendPairs, bendRest };
}

// --- Simulation state --------------------------------------------------------

export interface GarmentSimState {
  positions: Float32Array;
  previous: Float32Array;
  pinned: Uint8Array;
  regions: Uint8Array;
  /** Per-vertex worst edge stretch ratio from the last step -- tightness map. */
  stretch: Float32Array;
  /** Per-vertex outward push applied by collision, metres. */
  contact: Float32Array;
  /**
   * Signed distance from each vertex to the body along the body normal, as of
   * the last collision pass. Cached so the face pass can skip the fabric that
   * is nowhere near the skin.
   */
  gap: Float32Array;
  /** Nearest pinned vertex, per vertex (long-range attachment). */
  tetherAnchor: Uint32Array;
  /** Distance to that anchor measured along the cloth, metres. */
  tetherRest: Float32Array;
  /** Placed positions at yaw = 0; pinned vertices are re-derived from these. */
  basePositions: Float32Array;
  /** Nearest body vertex, refreshed once per step and reused across iterations. */
  nearest: Int32Array;
  /** Triangle list, needed to test faces as well as vertices for collision. */
  indices: Uint32Array;
  /**
   * The settled drape, in body-local space, or null before it is captured.
   *
   * Collision can only push cloth OUT; nothing pulls it back. Spin the body
   * fast enough and a sleeve rides up over the shoulder, and from there no
   * force returns it -- the shirt comes off and stays off. Real clothing stays
   * on because it cannot pass through the body and because it grips; neither
   * survives a solver that only ever pushes.
   */
  restLocal: Float32Array | null;
}

/**
 * Freezes the current shape as the one the cloth is allowed to drift around.
 *
 * Taken AFTER settling, not at placement: the garment legitimately drops
 * several centimetres as it drapes, and anchoring to the placed position would
 * fight that and hold the shirt up in the air.
 */
export function captureRestShape(state: GarmentSimState): void {
  state.restLocal = new Float32Array(state.positions);
}

/** Turns the body. Pinned vertices snap to the new heading, the rest lag. */
export function setBodyYaw(state: GarmentSimState, yaw: number): void {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const { basePositions, positions, pinned } = state;
  for (let v = 0; v < pinned.length; v++) {
    if (!pinned[v]) continue;
    const p = v * 3;
    const x = basePositions[p];
    const z = basePositions[p + 2];
    positions[p] = x * c + z * sn;
    positions[p + 1] = basePositions[p + 1];
    positions[p + 2] = -x * sn + z * c;
  }
}

/**
 * Long-range attachments (Mueller et al.): the shortest path along the fabric
 * from every vertex to the nearest pinned vertex.
 *
 * A chain of local distance constraints cannot hold a hanging garment -- each
 * pass only removes part of the error, so a 1700-vertex shirt still elongated
 * ~27% under its own weight no matter how many passes ran. Bounding the
 * straight-line distance to the anchor fixes total elongation directly, in one
 * cheap pass per vertex, instead of asking a serial chain to converge.
 */
function buildTethers(
  vertexCount: number,
  edges: Uint32Array,
  restLengths: Float32Array,
  pinned: Uint8Array,
  placed: Float32Array,
): { anchor: Uint32Array; rest: Float32Array } {
  const head = new Int32Array(vertexCount).fill(-1);
  const next = new Int32Array(edges.length).fill(-1);
  const to = new Uint32Array(edges.length);
  const weight = new Float32Array(edges.length);

  let slot = 0;
  for (let e = 0; e < restLengths.length; e++) {
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];
    to[slot] = b; weight[slot] = restLengths[e]; next[slot] = head[a]; head[a] = slot++;
    to[slot] = a; weight[slot] = restLengths[e]; next[slot] = head[b]; head[b] = slot++;
  }

  const dist = new Float32Array(vertexCount).fill(Infinity);
  const anchor = new Uint32Array(vertexCount);
  const done = new Uint8Array(vertexCount);
  for (let v = 0; v < vertexCount; v++) {
    if (pinned[v]) {
      dist[v] = 0;
      anchor[v] = v;
    }
  }

  // Dense Dijkstra: one-off per size, and n is small enough that a heap would
  // cost more in complexity than it saves.
  for (let iter = 0; iter < vertexCount; iter++) {
    let u = -1;
    let best = Infinity;
    for (let v = 0; v < vertexCount; v++) {
      if (!done[v] && dist[v] < best) {
        best = dist[v];
        u = v;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    for (let e = head[u]; e !== -1; e = next[e]) {
      const v = to[e];
      const d = dist[u] + weight[e];
      if (d < dist[v]) {
        dist[v] = d;
        anchor[v] = anchor[u];
      }
    }
  }

  // The bound is the STRAIGHT-LINE distance to the anchor in the placed pose,
  // not the geodesic Dijkstra just measured.
  //
  // A geodesic runs over the surface and around the body, so it is always the
  // longer of the two -- 65 cm to the hem against 60 cm in a straight line.
  // Comparing a straight-line distance against a geodesic limit therefore left
  // 5 cm of slack before the tether did anything, and the shirt used it: it
  // sagged 6.9 cm, which put the hem level with the crotch, and a hem sitting
  // between two legs folds into the gap. Measured against the placed pose
  // instead, the same 3% plus 1.5 cm actually bites.
  for (let v = 0; v < vertexCount; v++) {
    if (!Number.isFinite(dist[v])) continue;
    const a = anchor[v] * 3;
    const p = v * 3;
    dist[v] = Math.hypot(placed[p] - placed[a], placed[p + 1] - placed[a + 1], placed[p + 2] - placed[a + 2]);
  }

  return { anchor, rest: dist };
}

/**
 * Places the garment on the body by its anchor line and pins one ring region.
 *
 * A top hangs from the collar at the shoulder line; trousers hang from the
 * waistband at the waist line. Both are a closed ring of vertices that stays
 * kinematic while the rest of the cloth drapes -- same model, different
 * region id and different anchor height (see the metadata's pinRegion).
 */
export function createSimState(
  geom: GarmentGeometry,
  collider: BodyCollider,
  constraints: GarmentConstraints,
  ease = 0.014,
  pinRegion: number = GARMENT_REGION.collar,
  anchorY: number = collider.shoulderY,
): GarmentSimState {
  const n = geom.positions.length / 3;
  const positions = new Float32Array(geom.positions);

  for (let v = 0; v < n; v++) {
    positions[v * 3 + 1] += anchorY;
    positions[v * 3 + 2] += collider.axisZ;
  }

  const pinned = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    // Only the anchor ring is kinematic. Pinning the band next to it too was
    // the wrong model for the shirt: an edge between two pinned vertices has no
    // free endpoint, so the solver cannot correct it. The rest RESTS on the
    // body and is carried by contact plus friction.
    if (geom.regions[v] === pinRegion) pinned[v] = 1;
  }

  // Pinned vertices skip collision for the whole run, so if the collar starts
  // inside the skin it stays there and drags the yoke with it -- that was the
  // last ~1 cm of shirt visible through the shoulders. Projecting it out was
  // tried before against the radial field and tore the ring, because at collar
  // height a max-radius-per-bin field sees the SHOULDERS, not the neck. The
  // body mesh has no such blind spot, so the same idea is safe here.
  //
  // Projecting each collar vertex on its own SCALLOPS the neckline. The push is
  // whatever that one vertex needs, along the normal of whichever body vertex
  // happens to be nearest, and around the collar the nearest feature switches
  // between neck and trapezius. Measured on the built mesh the neckline runs
  // smooth (2.5 -> 5.6 -> a flat 5.0 across the back); after projection the
  // same ring oscillated between 2.2 and 6.6 cm, three peaks over the back --
  // the wavy collar seen from behind. Pinned vertices are never touched again,
  // so nothing downstream irons it out.
  //
  // Projection and smoothing take turns, the same way the stretch cap and
  // collision do further down: smoothing alone drags vertices back into the
  // skin, projection alone leaves the scallop, alternating converges on a ring
  // that is both smooth and outside.
  const collarNeighbours: number[][] = [];
  for (let v = 0; v < n; v++) collarNeighbours.push([]);
  for (let e = 0; e < constraints.restLengths.length; e++) {
    const a = constraints.edges[e * 2];
    const b = constraints.edges[e * 2 + 1];
    if (!pinned[a] || !pinned[b]) continue;
    collarNeighbours[a].push(b);
    collarNeighbours[b].push(a);
  }

  const projectCollar = () => {
    for (let v = 0; v < n; v++) {
      if (!pinned[v]) continue;
      const p = v * 3;
      const nb = nearestBodyVertex(collider, positions[p], positions[p + 1], positions[p + 2]);
      if (nb < 0) continue;
      const q = nb * 3;
      const nx = collider.normals[q];
      const ny = collider.normals[q + 1];
      const nz = collider.normals[q + 2];
      const sd =
        (positions[p] - collider.positions[q]) * nx +
        (positions[p + 1] - collider.positions[q + 1]) * ny +
        (positions[p + 2] - collider.positions[q + 2]) * nz;
      if (sd >= ease) continue;
      const push = ease - sd;
      positions[p] += nx * push;
      positions[p + 1] += ny * push;
      positions[p + 2] += nz * push;
    }
  };

  const smoothCollar = () => {
    const moved = new Float32Array(positions);
    for (let v = 0; v < n; v++) {
      if (!pinned[v]) continue;
      const ring = collarNeighbours[v];
      if (ring.length < 2) continue;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const u of ring) {
        cx += positions[u * 3];
        cy += positions[u * 3 + 1];
        cz += positions[u * 3 + 2];
      }
      const k = ring.length;
      const p = v * 3;
      moved[p] = positions[p] + (cx / k - positions[p]) * COLLAR_SMOOTHING;
      moved[p + 1] = positions[p + 1] + (cy / k - positions[p + 1]) * COLLAR_SMOOTHING;
      moved[p + 2] = positions[p + 2] + (cz / k - positions[p + 2]) * COLLAR_SMOOTHING;
    }
    positions.set(moved);
  };

  for (let round = 0; round < 8; round++) {
    projectCollar();
    smoothCollar();
  }
  projectCollar();

  const tethers = buildTethers(n, constraints.edges, constraints.restLengths, pinned, positions);

  return {
    positions,
    previous: new Float32Array(positions),
    pinned,
    regions: geom.regions,
    stretch: new Float32Array(n),
    contact: new Float32Array(n),
    gap: new Float32Array(n).fill(1),
    tetherAnchor: tethers.anchor,
    tetherRest: tethers.rest,
    basePositions: new Float32Array(positions),
    nearest: new Int32Array(n * COLLIDER_CANDIDATES).fill(-1),
    indices: geom.indices,
    restLocal: null,
  };
}

// --- Simulation --------------------------------------------------------------

export interface SimStepOptions {
  fabric?: Fabric;
  /** Seconds per step. */
  dt?: number;
  /** Constraint solver passes per step. */
  iterations?: number;
  /** Minimum air gap kept between skin and cloth, metres. */
  ease?: number;
  gravity?: number;
  /** Fraction of tangential sliding cancelled at a contact, 0..1. */
  friction?: number;
  /**
   * Largest correction a single collision application may make, metres.
   *
   * Unbounded, one bad nearest-vertex pick in a crease can report the cloth as
   * being 8 cm inside and fling it that far in one go, tearing it away from its
   * neighbours -- edges reached five times their rest length. Deep penetration
   * then resolves over several passes instead of one jump.
   */
  maxPush?: number;
  /**
   * How far a vertex may stray from the settled drape, metres.
   *
   * Wide enough that a loose hem still swings (measured flare is ~1.4 cm) and
   * narrow enough that the garment cannot leave the body.
   */
  maxDrift?: number;
  /**
   * Sweeps of the final stretch-cap pass, over 4 rounds.
   *
   * The cap is Gauss-Seidel and the shirt hangs off the collar in one long
   * tension chain, so it needs many sweeps to reach the limit exactly: 3
   * leaves the fabric at 1.28 against a 1.2 cap, 10 brings it to 1.215. But 10
   * sweeps x 4 rounds is 205k edge corrections, about 45% of the whole step --
   * far too much to pay 120 times a second for a number that is already right
   * to a few percent.
   *
   * So it is thorough where it matters and cheap where it does not. A settled
   * garment barely moves between frames, so a few sweeps hold the limit that
   * the settle established; the expensive convergence runs once, at the end of
   * settleGarment and of the canvas warm-up.
   */
  capSweeps?: number;
}

/**
 * Static friction at a contact, applied to POSITION rather than velocity.
 *
 * Damping velocity alone does not hold a garment up: gravity re-applies every
 * step, so the cloth creeps down the body a little each time. Cancelling the
 * part of this step's displacement that slid ALONG the surface is what makes
 * the shoulders carry the shirt.
 */
function applyContactFriction(
  state: GarmentSimState,
  v: number,
  nx: number,
  ny: number,
  nz: number,
  mu: number,
): void {
  const p = v * 3;
  const dx = state.positions[p] - state.previous[p];
  const dy = state.positions[p + 1] - state.previous[p + 1];
  const dz = state.positions[p + 2] - state.previous[p + 2];
  const dn = dx * nx + dy * ny + dz * nz;
  state.positions[p] -= (dx - dn * nx) * mu;
  state.positions[p + 1] -= (dy - dn * ny) * mu;
  state.positions[p + 2] -= (dz - dn * nz) * mu;
}

/** Advances the cloth one step. Call it per frame. */
export function stepGarmentSim(
  state: GarmentSimState,
  constraints: GarmentConstraints,
  collider: BodyCollider,
  options: SimStepOptions = {},
): void {
  const {
    fabric = FABRICS.knit,
    dt = 1 / 60,
    iterations = 8,
    // 1.4 cm of air. The probe only tests VERTICES, so a body bulge can push
    // through the middle of a quad with all four corners outside the skin --
    // exactly what stayed visible at the deltoid while the report read 0.0 cm.
    // Holding the cloth further off the skin costs a little puffiness and
    // removes a whole class of face-level pokethrough.
    ease = 0.014,
    gravity = 9.81,
    friction = 0.7,
    maxDrift = 0.06,
    maxPush = 0.015,
    capSweeps = 3,
  } = options;

  const { positions, previous, pinned } = state;
  const n = positions.length / 3;
  const gdt = -gravity * dt * dt;

  const yaw = collider.yaw ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  // Verlet integration.
  for (let v = 0; v < n; v++) {
    if (pinned[v]) continue;
    const p = v * 3;
    for (let c = 0; c < 3; c++) {
      const cur = positions[p + c];
      const vel = (cur - previous[p + c]) * fabric.damping;
      previous[p + c] = cur;
      positions[p + c] = cur + vel + (c === 1 ? gdt : 0);
    }
  }

  // The closest body feature is refreshed once per STEP, not once per
  // iteration: within a step the cloth moves by well under a millimetre, far
  // less than the ~1 cm body vertex spacing, so re-querying the grid eight
  // times would cost 8x for an answer that does not change.
  for (let v = 0; v < n; v++) {
    if (pinned[v]) continue;
    const p = v * 3;
    const wx = positions[p];
    const wz = positions[p + 2];
    nearestBodyVertices(
      collider,
      wx * cy - wz * sy,
      positions[p + 1],
      wx * sy + wz * cy,
      state.nearest,
      v * COLLIDER_CANDIDATES,
    );
  }

  const { edges, restLengths, bendPairs, bendRest } = constraints;
  const { positions: bp, normals: bn } = collider;
  state.stretch.fill(1);
  state.contact.fill(0);

  for (let it = 0; it < iterations; it++) {
    const last = it === iterations - 1;

    // Structural edges. Stretching is resisted and hard-capped; compression is
    // nearly free so the fabric can buckle into folds. Compression being free
    // is the single most important detail here: a stiff two-sided distance
    // constraint gives a barrel, not a garment.
    for (let e = 0; e < restLengths.length; e++) {
      const ia = edges[e * 2];
      const ib = edges[e * 2 + 1];
      const a = ia * 3;
      const b = ib * 3;
      const dx = positions[b] - positions[a];
      const dy = positions[b + 1] - positions[a + 1];
      const dz = positions[b + 2] - positions[a + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const rest = restLengths[e];
      const ratio = len / rest;

      let target: number;
      if (ratio > fabric.maxStretch) target = rest * fabric.maxStretch;
      else if (ratio > 1) target = len - (len - rest) * fabric.stretchStiffness;
      else target = len - (len - rest) * fabric.compressStiffness;

      const wa = pinned[ia] ? 0 : 1;
      const wb = pinned[ib] ? 0 : 1;
      const wsum = wa + wb;
      if (wsum === 0) continue;
      const corr = (len - target) / len / wsum;
      if (wa) {
        positions[a] += dx * corr;
        positions[a + 1] += dy * corr;
        positions[a + 2] += dz * corr;
      }
      if (wb) {
        positions[b] -= dx * corr;
        positions[b + 1] -= dy * corr;
        positions[b + 2] -= dz * corr;
      }
    }

    // Long-range attachment: no vertex may sit further from its anchor than
    // the fabric between them can reach. One pass, no convergence problem.
    const { tetherAnchor, tetherRest } = state;
    for (let v = 0; v < n; v++) {
      if (pinned[v]) continue;
      const rest = tetherRest[v];
      const limit = rest * fabric.tetherSlack + TETHER_FREE_SLACK;
      if (!Number.isFinite(limit)) continue;
      const p = v * 3;
      const q = tetherAnchor[v] * 3;
      const dx = positions[p] - positions[q];
      const dy = positions[p + 1] - positions[q + 1];
      const dz = positions[p + 2] - positions[q + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= limit || d < 1e-9) continue;
      const k = limit / d;
      positions[p] = positions[q] + dx * k;
      positions[p + 1] = positions[q + 1] + dy * k;
      positions[p + 2] = positions[q + 2] + dz * k;
    }

    // Shape tether: stay within reach of the settled drape, rotated to the
    // body's current heading. Runs before collision so collision still wins
    // and can never be overridden into the skin.
    if (state.restLocal && maxDrift > 0) {
      const rest = state.restLocal;
      for (let v = 0; v < n; v++) {
        if (pinned[v]) continue;
        const p = v * 3;
        const rx = rest[p];
        const rz = rest[p + 2];
        const tx = rx * cy + rz * sy;
        const tz = -rx * sy + rz * cy;
        const dx = positions[p] - tx;
        const dy = positions[p + 1] - rest[p + 1];
        const dz = positions[p + 2] - tz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= maxDrift || d < 1e-9) continue;
        const k = maxDrift / d;
        positions[p] = tx + dx * k;
        positions[p + 1] = rest[p + 1] + dy * k;
        positions[p + 2] = tz + dz * k;
      }
    }

    // Bending: keeps folds at a plausible scale instead of letting the cloth
    // crumple to nothing. Two-sided, unlike the structural pass.
    if (fabric.bendStiffness > 0) {
      for (let e = 0; e < bendRest.length; e++) {
        const ia = bendPairs[e * 2];
        const ib = bendPairs[e * 2 + 1];
        const a = ia * 3;
        const b = ib * 3;
        const dx = positions[b] - positions[a];
        const dy = positions[b + 1] - positions[a + 1];
        const dz = positions[b + 2] - positions[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) continue;
        const wa = pinned[ia] ? 0 : 1;
        const wb = pinned[ib] ? 0 : 1;
        const wsum = wa + wb;
        if (wsum === 0) continue;
        const corr = (((len - bendRest[e]) / len) * fabric.bendStiffness) / wsum;
        if (wa) {
          positions[a] += dx * corr;
          positions[a + 1] += dy * corr;
          positions[a + 2] += dz * corr;
        }
        if (wb) {
          positions[b] -= dx * corr;
          positions[b + 1] -= dy * corr;
          positions[b + 2] -= dz * corr;
        }
      }
    }

    resolveCollisions(last);
  }

  // Stretch cap and collision take turns until both are close to satisfied.
  //
  // Whichever runs last simply wins, and both orders are wrong: cap last drags
  // the sleeve back inside the shoulder (measured 1 cm deep over 18% of the
  // sleeve), collision last blows the fabric limit wide open (maxStretch 7.2
  // against a cap of 1.2). Alternating lets them converge instead of undoing
  // each other, and ending on collision keeps the visible result clean.
  // Every constraint gets a turn in the same rotation, faces included.
  //
  // Faces matter because a vertex-only test misses a body bulge that pokes
  // through the MIDDLE of a triangle with all three corners outside the skin
  // -- two patches of shoulder stayed visible through an otherwise closed mesh
  // because of it. But putting the face pass outside the rotation and then
  // capping the stretch afterwards simply undid it: the cap pulled the corners
  // straight back in. Two fixes cancelling each other, each one verified alone.
  // 8 rounds, measured. At 5 the cloth ends up 2.5 cm inside the body against
  // a 1.5 cm budget -- this alternation is what keeps it out, not the cheap
  // finishing pass after it.
  for (let round = 0; round < 8; round++) {
    enforceStretchCap(3);
    resolveCollisions(false);
  }

  // Tail order matters and both extremes are worse. Ending on the cap gives a
  // tidy stretch number but undoes the face pass; ending on the face pass
  // keeps the cloth out but leaves the fabric limit blown (3.94 against 1.2).
  // Faces, then a late cap, then the cheap vertex pass so nothing is left
  // sitting inside the skin.
  // The shirt hangs off the pinned collar, so the tension runs in one long
  // chain from the neck down. Gauss-Seidel walks that chain one edge per sweep:
  // with 2 sweeps the fabric limit read 1.28 against a 1.2 cap, and the excess
  // sat in the yoke and centre back -- right under the anchor -- not out at the
  // hem. 10 sweeps brings it to 1.215 and further sweeps do not move it. See
  // capSweeps for why that is not the default.
  resolveFaceCollisions();
  for (let round = 0; round < 4; round++) {
    enforceStretchCap(capSweeps);
    resolveCollisions(false);
  }

  // Record the stretch that actually survived the whole step.
  for (let e = 0; e < restLengths.length; e++) {
    const ia = edges[e * 2];
    const ib = edges[e * 2 + 1];
    // An edge between two kinematic vertices is part of the anchor, not fabric
    // under load: the solver cannot move either end, and the collar ring gets
    // reshaped when it is projected onto the neck. Counting it reported the
    // whole garment as stretched 1.8x on every size alike, which described the
    // placement and nothing about the cloth.
    if (pinned[ia] && pinned[ib]) continue;
    const a = ia * 3;
    const b = ib * 3;
    const dx = positions[b] - positions[a];
    const dy = positions[b + 1] - positions[a + 1];
    const dz = positions[b + 2] - positions[a + 2];
    const ratio = Math.sqrt(dx * dx + dy * dy + dz * dz) / restLengths[e];
    if (ratio > state.stretch[ia]) state.stretch[ia] = ratio;
    if (ratio > state.stretch[ib]) state.stretch[ib] = ratio;
  }

  /**
   * Pushes out any triangle whose centre is inside the body.
   *
   * Runs once per step rather than per iteration: it costs one grid query per
   * triangle, and a bulge that pokes through a face does not appear and vanish
   * within a single step.
   */
  function resolveFaceCollisions() {
    const idx = state.indices;
    const gap = state.gap;

    /** Pushes a triangle's free corners out if the sample point is inside. */
    const testPoint = (
      wx: number, wy: number, wz: number, i0: number, i1: number, i2: number,
    ) => {
      const lx = wx * cy - wz * sy;
      const lz = wx * sy + wz * cy;
      const nb = nearestBodyVertex(collider, lx, wy, lz);
      if (nb < 0) return;
      const q = nb * 3;
      const nx = bn[q];
      const ny = bn[q + 1];
      const nz = bn[q + 2];
      const sd = (lx - bp[q]) * nx + (wy - bp[q + 1]) * ny + (lz - bp[q + 2]) * nz;
      if (sd >= ease) return;

      const push = Math.min(ease - sd, maxPush);
      const dx = (nx * cy + nz * sy) * push;
      const dy = ny * push;
      const dz = (-nx * sy + nz * cy) * push;
      if (!pinned[i0]) { positions[i0 * 3] += dx; positions[i0 * 3 + 1] += dy; positions[i0 * 3 + 2] += dz; }
      if (!pinned[i1]) { positions[i1 * 3] += dx; positions[i1 * 3 + 1] += dy; positions[i1 * 3 + 2] += dz; }
      if (!pinned[i2]) { positions[i2 * 3] += dx; positions[i2 * 3 + 1] += dy; positions[i2 * 3 + 2] += dz; }
    };

    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t];
      const i1 = idx[t + 1];
      const i2 = idx[t + 2];

      // Skip fabric that is nowhere near the skin. The face pass exists for a
      // bulge poking through the middle of a triangle whose corners are all
      // outside; over a body of curvature radius R a triangle of edge L bows
      // by only L^2/8R, which for this mesh (L = 1.5 cm) against the tightest
      // curve on the body (the forearm, R = 5 cm) is 0.6 mm. A corner-gap
      // threshold of 2 cm is thirty times that, so nothing real is skipped.
      //
      // It buys less than it looks like it should, and the honest reason is
      // that the cloth hovers at the ease distance almost everywhere: mean gap
      // is 1.9 cm on a fitting size, so only the loose sizes skip much. This
      // machine was too noisy to measure the difference (the same build timed
      // 21 ms and 27 ms per step), so treat it as free correctness, not as a
      // measured speedup.
      if (gap[i0] > FACE_SKIP_GAP && gap[i1] > FACE_SKIP_GAP && gap[i2] > FACE_SKIP_GAP) {
        continue;
      }

      const a = i0 * 3;
      const b = i1 * 3;
      const c = i2 * 3;

      testPoint(
        (positions[a] + positions[b] + positions[c]) / 3,
        (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3,
        (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3,
        i0, i1, i2,
      );

    }
  }

  /** Projects any edge longer than the fabric limit back onto it. */
  function enforceStretchCap(passes: number) {
    for (let pass = 0; pass < passes; pass++) {
      for (let e = 0; e < restLengths.length; e++) {
        const ia = edges[e * 2];
        const ib = edges[e * 2 + 1];
        const a = ia * 3;
        const b = ib * 3;
        const dx = positions[b] - positions[a];
        const dy = positions[b + 1] - positions[a + 1];
        const dz = positions[b + 2] - positions[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const cap = restLengths[e] * fabric.maxStretch;
        if (len <= cap || len < 1e-9) continue;
        const wa = pinned[ia] ? 0 : 1;
        const wb = pinned[ib] ? 0 : 1;
        const wsum = wa + wb;
        if (wsum === 0) continue;
        const corr = (len - cap) / len / wsum;
        if (wa) {
          positions[a] += dx * corr;
          positions[a + 1] += dy * corr;
          positions[a + 2] += dz * corr;
        }
        if (wb) {
          positions[b] -= dx * corr;
          positions[b + 1] -= dy * corr;
          positions[b + 2] -= dz * corr;
        }
      }
    }
  }

  /** Pushes every free vertex outside the body, along the body's own normals. */
  function resolveCollisions(withFriction: boolean) {
    for (let v = 0; v < n; v++) {
      if (pinned[v]) continue;
      const p = v * 3;
      let moved = false;
      let fx = 0;
      let fy = 0;
      let fz = 0;

      for (let c = 0; c < COLLIDER_CANDIDATES; c++) {
        const nb = state.nearest[v * COLLIDER_CANDIDATES + c];
        if (nb < 0) continue;

        const wx = positions[p];
        const wz = positions[p + 2];
        const lx = wx * cy - wz * sy;
        const ly = positions[p + 1];
        const lz = wx * sy + wz * cy;

        const q = nb * 3;
        const nx = bn[q];
        const ny = bn[q + 1];
        const nz = bn[q + 2];
        const sd = (lx - bp[q]) * nx + (ly - bp[q + 1]) * ny + (lz - bp[q + 2]) * nz;
        if (c === 0 || sd < state.gap[v]) state.gap[v] = sd;
        if (sd >= ease) continue;

        const push = Math.min(ease - sd, maxPush);
        const px = lx + nx * push;
        const py = ly + ny * push;
        const pz = lz + nz * push;
        positions[p] = px * cy + pz * sy;
        positions[p + 1] = py;
        positions[p + 2] = -px * sy + pz * cy;

        if (push > state.contact[v]) state.contact[v] = push;
        moved = true;
        fx = nx;
        fy = ny;
        fz = nz;
      }

      if (withFriction && moved) {
        applyContactFriction(state, v, fx * cy + fz * sy, fy, -fx * sy + fz * cy, friction);
      }
    }
  }

}

// --- Reporting ---------------------------------------------------------------

export interface DrapeReport {
  /** Worst edge stretch across the garment, 1.0 = at rest. */
  maxStretch: number;
  /** Share of vertices stretched more than 2%. */
  stretchedFraction: number;
  /**
   * Share of edges left beyond the fabric's stretch limit.
   *
   * Not a solver score -- a fit verdict. When a garment is far too small the
   * constraints are simply infeasible: the cloth cannot both stay out of the
   * body and stay within the fabric's limit, and something has to give. This
   * counts how much of the garment is in that state, so "this size will not go
   * on" can be said out loud instead of quietly drawing an impossible drape.
   */
  overStretchedFraction: number;
  /** Share of vertices touching the body. */
  contactFraction: number;
  /** Mean cloth-to-skin gap, cm -- how baggy it hangs. */
  meanGapCm: number;
  /** How far the hem dropped below its starting height, cm. */
  hemDropCm: number;
  /** Deepest point the cloth ends up INSIDE the skin, cm. Should be ~0. */
  maxInsideCm: number;
  /** Share of vertices left inside the skin. */
  insideFraction: number;
  /** Region carrying the deepest penetration, for diagnosis. */
  worstInsideRegion: number;
}

/** Runs the sim to rest and measures the drape. Used headless and on load. */
export function settleGarment(
  geom: GarmentGeometry,
  constraints: GarmentConstraints,
  collider: BodyCollider,
  options: SimStepOptions & { steps?: number } = {},
): { state: GarmentSimState; report: DrapeReport } {
  const { steps = 220, ...stepOptions } = options;
  const state = createSimState(geom, collider, constraints);

  let hemStart = 0;
  let hemCount = 0;
  for (let v = 0; v < state.regions.length; v++) {
    if (state.regions[v] !== GARMENT_REGION.hem) continue;
    hemStart += state.positions[v * 3 + 1];
    hemCount++;
  }
  hemStart = hemCount ? hemStart / hemCount : 0;

  // Settle cheap, finish thorough. The drape is decided by where the cloth
  // ends up, not by how exactly the fabric limit was held on the way there, so
  // the expensive cap convergence only has to run on the last handful of steps.
  for (let s = 0; s < steps; s++) stepGarmentSim(state, constraints, collider, stepOptions);
  for (let s = 0; s < CAP_FINISH_STEPS; s++) {
    stepGarmentSim(state, constraints, collider, { ...stepOptions, capSweeps: 10 });
  }
  captureRestShape(state);

  const n = state.positions.length / 3;
  let maxStretch = 1;
  let stretched = 0;
  let contact = 0;
  let gapSum = 0;
  let gapCount = 0;
  let hemEnd = 0;
  let inside = 0;
  let maxInside = 0;
  let overStretched = 0;
  let edgeCount = 0;
  let worstInsideRegion = -1;

  const yaw = collider.yaw ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const { edges, restLengths } = constraints;
  // Cap plus the solver's own residual. enforceStretchCap is Gauss-Seidel: a
  // long tension chain (the whole shirt hangs off the pinned collar) needs many
  // sweeps to settle, and the collision pass right after it nudges vertices
  // back out. Measured, the residual converges to about 1.5% over the cap and
  // stops improving -- 10 sweeps x 4 rounds gets max 1.215 against a 1.2 cap,
  // and more sweeps only cost time. Counting those as over-stretched reported
  // 12% of the shirt as blown when every one of them was sitting AT the limit.
  const cap = (options.fabric ?? FABRICS.knit).maxStretch * 1.02;
  for (let e = 0; e < restLengths.length; e++) {
    const ia = edges[e * 2];
    const ib = edges[e * 2 + 1];
    // Same exclusion as state.stretch above: an edge with both ends kinematic
    // is the collar anchor, not fabric under load. The solver cannot move
    // either end -- enforceStretchCap skips it too -- and the ring gets
    // reshaped when it is projected onto the neck, so it reads 1.44 forever
    // however the cloth behaves. Counting it described the placement.
    if (state.pinned[ia] && state.pinned[ib]) continue;
    const a = ia * 3;
    const b = ib * 3;
    const dx = state.positions[b] - state.positions[a];
    const dy = state.positions[b + 1] - state.positions[a + 1];
    const dz = state.positions[b + 2] - state.positions[a + 2];
    edgeCount++;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) / restLengths[e] > cap) {
      overStretched++;
    }
  }

  for (let v = 0; v < n; v++) {
    if (state.stretch[v] > maxStretch) maxStretch = state.stretch[v];
    if (state.stretch[v] > 1.02) stretched++;
    if (state.contact[v] > 0) contact++;
    if (state.regions[v] === GARMENT_REGION.hem) hemEnd += state.positions[v * 3 + 1];

    const p = v * 3;
    const wx = state.positions[p];
    const wz = state.positions[p + 2];
    const sd = signedDistanceToBody(
      collider,
      wx * cy - wz * sy,
      state.positions[p + 1],
      wx * sy + wz * cy,
    );
    if (sd === null) continue;
    gapSum += sd;
    gapCount++;
    if (sd < 0) {
      inside++;
      if (-sd > maxInside) {
        maxInside = -sd;
        worstInsideRegion = state.regions[v];
      }
    }
  }
  hemEnd = hemCount ? hemEnd / hemCount : 0;

  return {
    state,
    report: {
      maxStretch,
      stretchedFraction: stretched / n,
      overStretchedFraction: edgeCount ? overStretched / edgeCount : 0,
      contactFraction: contact / n,
      meanGapCm: gapCount ? (gapSum / gapCount) * 100 : 0,
      hemDropCm: (hemStart - hemEnd) * 100,
      maxInsideCm: maxInside * 100,
      insideFraction: gapCount ? inside / gapCount : 0,
      worstInsideRegion,
    },
  };
}
