/**
 * Pure body-measurement <-> morph-target solver for the MakeHuman-derived
 * avatar mesh. No three.js / React imports here on purpose: this module runs
 * headless in Node (see tools/avatar-pipeline/solve_report.mjs) so solver
 * accuracy can be measured without a browser or GPU.
 *
 * See AVATAR_TEST_HANDOFF.md §4 for the full design rationale.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

export interface AvatarBodyInput {
  gender: Gender;
  height: number; // cm
  weight: number; // kg
  chest: number; // cm
  waist: number; // cm
  hip: number; // cm
  shoulderWidth: number; // cm (tape-measure convention, arc over the deltas)
  armLength: number; // cm
  inseam: number; // cm
  neck?: number; // cm, optional
}

export interface BodyMeasurementSet {
  height: number;
  chest: number;
  waist: number;
  hip: number;
  shoulderWidth: number; // raw mesh chord, NOT tape-measure convention
  armLength: number;
  inseam: number;
  neck: number;
}

export type MorphAxis =
  | 'height'
  | 'weight'
  | 'chest'
  | 'waist'
  | 'hip'
  | 'shoulder'
  | 'arm'
  | 'leg'
  | 'neck';

export type AxisValues = Record<MorphAxis, number>;

export const ZERO_AXES: AxisValues = {
  height: 0,
  weight: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  shoulder: 0,
  arm: 0,
  leg: 0,
  neck: 0,
};

export interface AvatarMetadata {
  morphOrder: string[];
  measureRings: Record<string, number[]>;
  landmarks: Record<Gender, { acromionLeft: number; acromionRight: number; crotch: number }>;
  vertexToOriginal: number[];
  units: string;
  source: string;
  build?: unknown;
}

/** Flat xyz buffers, in the render-mesh's own vertex order (see build script). */
export interface MorphGeometryInput {
  position: Float32Array;
  morphDeltas: Float32Array[]; // length === metadata.morphOrder.length
}

export interface MorphRig {
  gender: Gender;
  vertexCount: number;
  position: Float32Array;
  morphDeltas: Float32Array[];
  morphIndex: Record<string, number>;
  originalToVertex: Int32Array;
  rings: Record<string, Int32Array>;
  landmarks: { acromionLeft: number; acromionRight: number; crotch: number };
  heightProbes: Int32Array;
  probeVertices: Int32Array;
}

// ---------------------------------------------------------------------------
// Axis <-> morph target contract
// ---------------------------------------------------------------------------

export const AXIS_LIMIT = 1.6; // hard solver + slider limit
export const AUTHORED_LIMIT = 1.0; // beyond this the shape is extrapolated
export const AXIS_RANGE = { min: -AXIS_LIMIT, max: AXIS_LIMIT, authored: AUTHORED_LIMIT };

const AXIS_TO_TARGETS: Record<MorphAxis, { incr: string[]; decr: string[] }> = {
  height: { incr: ['height_incr'], decr: ['height_decr'] },
  weight: { incr: ['weight_incr'], decr: ['weight_decr'] },
  chest: { incr: ['chest_incr'], decr: ['chest_decr'] },
  waist: { incr: ['waist_incr'], decr: ['waist_decr'] },
  hip: { incr: ['hip_incr'], decr: ['hip_decr'] },
  shoulder: { incr: ['shoulder_incr'], decr: ['shoulder_decr'] },
  arm: { incr: ['upperarm_incr', 'lowerarm_incr'], decr: ['upperarm_decr', 'lowerarm_decr'] },
  leg: { incr: ['upperleg_incr', 'lowerleg_incr'], decr: ['upperleg_decr', 'lowerleg_decr'] },
  neck: { incr: ['neck_incr'], decr: ['neck_decr'] },
};

export function axesToInfluences(rig: MorphRig, axes: AxisValues): Float32Array {
  const out = new Float32Array(rig.morphDeltas.length);
  for (const axis of Object.keys(AXIS_TO_TARGETS) as MorphAxis[]) {
    const value = axes[axis] ?? 0;
    if (value === 0) continue;
    const targets = value > 0 ? AXIS_TO_TARGETS[axis].incr : AXIS_TO_TARGETS[axis].decr;
    const magnitude = Math.abs(value);
    for (const name of targets) {
      const idx = rig.morphIndex[name];
      if (idx === undefined) throw new Error(`Unknown morph target "${name}"`);
      out[idx] = magnitude;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rig construction
// ---------------------------------------------------------------------------

export function createMorphRig(
  geometry: MorphGeometryInput,
  metadata: AvatarMetadata,
  gender: Gender,
): MorphRig {
  const vertexCount = geometry.position.length / 3;
  if (geometry.morphDeltas.length !== metadata.morphOrder.length) {
    throw new Error(
      `Expected ${metadata.morphOrder.length} morph targets, got ${geometry.morphDeltas.length}`,
    );
  }

  const morphIndex: Record<string, number> = {};
  metadata.morphOrder.forEach((name, i) => {
    morphIndex[name] = i;
  });

  let maxOriginal = 0;
  for (const orig of metadata.vertexToOriginal) if (orig > maxOriginal) maxOriginal = orig;
  const originalToVertex = new Int32Array(maxOriginal + 1).fill(-1);
  metadata.vertexToOriginal.forEach((orig, renderIdx) => {
    // First occurrence wins (UV-seam duplicates share the same position).
    if (originalToVertex[orig] === -1) originalToVertex[orig] = renderIdx;
  });

  const rings: Record<string, Int32Array> = {};
  for (const [name, origIds] of Object.entries(metadata.measureRings)) {
    const mapped = origIds.map((orig) => {
      const idx = originalToVertex[orig];
      if (idx === -1) {
        throw new Error(`Measurement ring "${name}" references vertex ${orig}`);
      }
      return idx;
    });
    rings[name] = Int32Array.from(mapped);
  }

  const lm = metadata.landmarks[gender];
  if (!lm) throw new Error(`No landmarks for gender "${gender}"`);
  const mapLandmark = (orig: number, label: string): number => {
    const idx = originalToVertex[orig];
    if (idx === -1) {
      throw new Error(`Landmark "${label}" references vertex ${orig}, not present in render mesh`);
    }
    return idx;
  };
  const landmarks = {
    acromionLeft: mapLandmark(lm.acromionLeft, 'acromionLeft'),
    acromionRight: mapLandmark(lm.acromionRight, 'acromionRight'),
    crotch: mapLandmark(lm.crotch, 'crotch'),
  };

  const heightProbes = computeHeightProbes(geometry, vertexCount);

  const probeSet = new Set<number>(heightProbes);
  for (const ring of Object.values(rings)) for (const v of ring) probeSet.add(v);
  probeSet.add(landmarks.acromionLeft);
  probeSet.add(landmarks.acromionRight);
  probeSet.add(landmarks.crotch);
  const probeVertices = Int32Array.from(probeSet);

  return {
    gender,
    vertexCount,
    position: geometry.position,
    morphDeltas: geometry.morphDeltas,
    morphIndex,
    originalToVertex,
    rings,
    landmarks,
    heightProbes,
    probeVertices,
  };
}

function computeHeightProbes(geometry: MorphGeometryInput, vertexCount: number): Int32Array {
  const yOf = (v: number) => geometry.position[v * 3 + 1];
  let argMin = 0;
  let argMax = 0;
  for (let v = 1; v < vertexCount; v++) {
    if (yOf(v) < yOf(argMin)) argMin = v;
    if (yOf(v) > yOf(argMax)) argMax = v;
  }
  const extremeSet = new Set<number>([argMin, argMax]);

  // Per-morph extrema at full +AXIS_LIMIT influence -- height/weight/leg morphs
  // can shift where the topmost/bottommost vertex lives.
  for (const delta of geometry.morphDeltas) {
    let mMin = 0;
    let mMax = 0;
    let mMinY = Infinity;
    let mMaxY = -Infinity;
    for (let v = 0; v < vertexCount; v++) {
      const y = geometry.position[v * 3 + 1] + delta[v * 3 + 1] * AXIS_LIMIT;
      if (y < mMinY) {
        mMinY = y;
        mMin = v;
      }
      if (y > mMaxY) {
        mMaxY = y;
        mMax = v;
      }
    }
    extremeSet.add(mMin);
    extremeSet.add(mMax);
  }

  // Safety margin: 64 highest + 64 lowest vertices at neutral, since the
  // extremum under a *combination* of morphs can be a neighbour of the
  // single-morph extremum rather than the extremum itself.
  const order = Array.from({ length: vertexCount }, (_, i) => i).sort((a, b) => yOf(a) - yOf(b));
  for (let i = 0; i < 64; i++) {
    extremeSet.add(order[i]);
    extremeSet.add(order[vertexCount - 1 - i]);
  }

  return Int32Array.from(extremeSet);
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export function measure(rig: MorphRig, axes: AxisValues): BodyMeasurementSet {
  const influences = axesToInfluences(rig, axes);
  const cache = new Map<number, [number, number, number]>();

  const getPos = (v: number): [number, number, number] => {
    const cached = cache.get(v);
    if (cached) return cached;
    let x = rig.position[v * 3];
    let y = rig.position[v * 3 + 1];
    let z = rig.position[v * 3 + 2];
    for (let m = 0; m < influences.length; m++) {
      const inf = influences[m];
      if (inf === 0) continue;
      const d = rig.morphDeltas[m];
      x += d[v * 3] * inf;
      y += d[v * 3 + 1] * inf;
      z += d[v * 3 + 2] * inf;
    }
    const p: [number, number, number] = [x, y, z];
    cache.set(v, p);
    return p;
  };

  const ringLengthMetres = (name: string): number => {
    const ring = rig.rings[name];
    let total = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = getPos(ring[i]);
      const b = getPos(ring[i + 1]);
      total += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
    return total;
  };

  const chest = ringLengthMetres('chest') * 100;
  const waist = ringLengthMetres('waist') * 100;
  const hip = ringLengthMetres('hip') * 100;
  const neck = ringLengthMetres('neck') * 100;
  const armLength = (ringLengthMetres('upperarm') + ringLengthMetres('lowerarm')) * 100;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of rig.heightProbes) {
    const p = getPos(v);
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const height = (maxY - minY) * 100;

  const acroL = getPos(rig.landmarks.acromionLeft);
  const acroR = getPos(rig.landmarks.acromionRight);
  const shoulderWidth =
    Math.hypot(acroL[0] - acroR[0], acroL[1] - acroR[1], acroL[2] - acroR[2]) * 100;

  const crotch = getPos(rig.landmarks.crotch);
  const inseam = (crotch[1] - minY) * 100;

  return { height, chest, waist, hip, shoulderWidth, armLength, inseam, neck };
}

// ---------------------------------------------------------------------------
// Weight -> BMI seed (never scales the mesh directly)
// ---------------------------------------------------------------------------

export const BMI_NEUTRAL = 22;
export const BMI_PER_AXIS_UNIT = 9;

export function weightAxisFromBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const raw = (bmi - BMI_NEUTRAL) / BMI_PER_AXIS_UNIT;
  return Math.max(-1, Math.min(1, raw));
}

// ---------------------------------------------------------------------------
// Calibration constant
// ---------------------------------------------------------------------------

/**
 * The mesh only measures the straight biacromial CHORD between the two
 * shoulder landmarks. A tape measure worn over the back follows the curve of
 * both deltoids and is therefore longer -- on this mesh, by a roughly
 * size-independent ~4.5 cm. Applied in exactly one place (here, via
 * solveAxes) and reported back the same way so it can be recalibrated by
 * measuring one real body both ways and adjusting this single number.
 */
export const SHOULDER_ARC_OFFSET_CM = 4.5;

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

export const SOLVE_PLAN: Array<{ axis: MorphAxis; dimension: keyof BodyMeasurementSet }> = [
  { axis: 'leg', dimension: 'inseam' },
  { axis: 'height', dimension: 'height' },
  { axis: 'shoulder', dimension: 'shoulderWidth' },
  { axis: 'chest', dimension: 'chest' },
  { axis: 'waist', dimension: 'waist' },
  { axis: 'hip', dimension: 'hip' },
  { axis: 'arm', dimension: 'armLength' },
  { axis: 'neck', dimension: 'neck' },
];
export const SOLVE_PASSES = 7;
export const BISECTION_STEPS = 26;

export interface DimensionResult {
  dimension: keyof BodyMeasurementSet;
  target: number;
  achieved: number;
  error: number; // achieved - target, cm
  outOfRange: boolean;
  extrapolated: boolean;
  meshValue: number; // raw mesh value, before unit-convention adjustment
  note?: string;
}

export interface SolveResult {
  axes: AxisValues;
  influences: Float32Array;
  measured: BodyMeasurementSet;
  dimensions: DimensionResult[];
  maxAbsError: number;
  passes: number;
}

function solveAxis(
  rig: MorphRig,
  axes: AxisValues,
  axis: MorphAxis,
  dimension: keyof BodyMeasurementSet,
  target: number,
): void {
  let lo = -AXIS_LIMIT;
  let hi = AXIS_LIMIT;
  const measureAt = (value: number): number => {
    axes[axis] = value;
    return measure(rig, axes)[dimension];
  };
  const atLo = measureAt(lo);
  const atHi = measureAt(hi);
  const increasing = atHi > atLo;

  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const val = measureAt(mid);
    const tooLow = increasing ? val < target : val > target;
    if (tooLow) lo = mid;
    else hi = mid;
  }
  axes[axis] = (lo + hi) / 2;
}

export function solveAxes(rig: MorphRig, input: AvatarBodyInput): SolveResult {
  const axes: AxisValues = { ...ZERO_AXES };
  // Seed weight first so the waist/chest/hip axes solve on a realistic body,
  // not the neutral shape.
  axes.weight = weightAxisFromBMI(input.height, input.weight);

  const targets: Partial<Record<keyof BodyMeasurementSet, number>> = {
    inseam: input.inseam,
    height: input.height,
    shoulderWidth: input.shoulderWidth - SHOULDER_ARC_OFFSET_CM,
    chest: input.chest,
    waist: input.waist,
    hip: input.hip,
    armLength: input.armLength,
  };
  if (input.neck !== undefined) targets.neck = input.neck;

  for (let pass = 0; pass < SOLVE_PASSES; pass++) {
    for (const { axis, dimension } of SOLVE_PLAN) {
      const target = targets[dimension];
      if (target === undefined) continue;
      solveAxis(rig, axes, axis, dimension, target);
    }
  }

  const measured = measure(rig, axes);

  const dimensions: DimensionResult[] = [];
  for (const { axis, dimension } of SOLVE_PLAN) {
    const target = targets[dimension];
    if (target === undefined) continue;

    const outOfRange = Math.abs(axes[axis]) >= AXIS_LIMIT - 1e-4;
    const extrapolated = Math.abs(axes[axis]) > AUTHORED_LIMIT;

    let achieved = measured[dimension];
    const meshValue = achieved;
    let reportedTarget = target;
    let note: string | undefined;

    if (dimension === 'shoulderWidth') {
      achieved = meshValue + SHOULDER_ARC_OFFSET_CM;
      reportedTarget = input.shoulderWidth;
      note = `Reported as biacromial chord + ${SHOULDER_ARC_OFFSET_CM} cm arc offset (tape-measure convention); see SHOULDER_ARC_OFFSET_CM.`;
    }

    dimensions.push({
      dimension,
      target: reportedTarget,
      achieved,
      error: achieved - reportedTarget,
      outOfRange,
      extrapolated,
      meshValue,
      note,
    });
  }

  const maxAbsError = dimensions.reduce((m, d) => Math.max(m, Math.abs(d.error)), 0);

  return {
    axes,
    influences: axesToInfluences(rig, axes),
    measured,
    dimensions,
    maxAbsError,
    passes: SOLVE_PASSES,
  };
}
