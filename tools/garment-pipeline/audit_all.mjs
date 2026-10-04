// Kiem tra moi mon x moi size x moi nguoi mau, cung duong du lieu voi trinh
// duyet (avatar GLB that, garment GLB that, solver that). Bat cac loi nhin
// thay duoc: vai an vao nguoi, gai / canh bi keo gian bat thuong, toa do hong,
// manh vai roi.
// Run: node --experimental-strip-types tools/garment-pipeline/audit_all.mjs [kind ...]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createMorphRig,
  solveAxes,
  axesToInfluences,
  measure,
} from '../../src/lib/avatar/avatarMorphService.ts';
import { PROFILES, FEMALE_PROFILES } from '../../src/lib/avatar/bodyProfiles.ts';
import {
  buildBodyCollider,
  buildConstraints,
  createSimState,
  stepGarmentSim,
  deformPositions,
  verdictForEase,
  FABRICS,
} from '../../src/lib/tryon/garmentFit.ts';
import { buildBodyGrid, computeVertexNormals, signedDistance } from './bodyProbe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../..', 'public', 'models');

// Vai mac dinh o trang thu (TEXTURES[kind][0].fabric trong GarmentTestApp).
const FABRIC_OF = {
  tshirt: 'knit', tank: 'knit', croptop: 'knit', sweater: 'knit',
  shirt: 'woven', longshirt: 'woven', skirt: 'woven', dress: 'woven', dressskirt: 'woven',
  pants: 'denim', shorts: 'denim', capri: 'denim', jacket: 'denim',
};

// Nguong. Xuyen: giong fit_report (1.5 cm / 5%). Gian: canh dai hon 1.6x
// do dai nghi la gai nhon / rach nhin thay ro (vai that toi da 1.2x).
const MAX_INSIDE_CM = 1.5;
const MAX_INSIDE_PCT = 5;
const MAX_EDGE_RATIO = 1.6;
const STEPS = 240;
// Canh ngan hon 6mm la vet gop dinh (cluster_decimate) -- gian vai lan van chi
// la vai mm, khuat trong nach / cap, khong nhin thay. Khong tinh.
const MIN_REST_M = 0.006;
// Size ma trang thu tu xep "Chật" (verdictForEase) thi bi gian la DUNG.
// Chi bao loi gian khi do mac vua hoac rong.

function loadGlb(filePath) {
  const buffer = readFileSync(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

function interleaveVec4(g, name) {
  const parts = [];
  for (let i = 1; ; i++) {
    const a = g.getAttribute(i === 1 ? name : `${name}${i}`);
    if (!a) break;
    parts.push(a.array);
  }
  if (!parts.length) return undefined;
  const n = parts[0].length / 4;
  const K = parts.length * 4;
  const out = new Float32Array(n * K);
  for (let v = 0; v < n; v++)
    for (let p = 0; p < parts.length; p++)
      for (let k = 0; k < 4; k++) out[v * K + p * 4 + k] = parts[p][v * 4 + k];
  return out;
}

const bodyIndices = {};
async function buildRig(gender) {
  const gltf = await loadGlb(path.join(MODELS_DIR, `avatar-${gender}.glb`));
  let mesh = null;
  gltf.scene.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o;
  });
  const metadata = JSON.parse(readFileSync(path.join(MODELS_DIR, 'avatar-metadata.json'), 'utf-8'));
  const position = mesh.geometry.getAttribute('position').array;
  const morphDeltas = metadata.morphOrder.map((_, i) => mesh.geometry.morphAttributes.position[i].array);
  bodyIndices[gender] = mesh.geometry.index.array;
  return createMorphRig({ position, morphDeltas }, metadata, gender);
}

const meta = JSON.parse(readFileSync(path.join(MODELS_DIR, 'garment-metadata.json'), 'utf-8'));
const bodyRefBuf = readFileSync(path.join(MODELS_DIR, 'body-reference.bin'));
const bodyRef = new Float32Array(
  bodyRefBuf.buffer.slice(bodyRefBuf.byteOffset, bodyRefBuf.byteOffset + bodyRefBuf.byteLength),
);

async function loadKind(kind) {
  const entry = meta.garments[kind];
  const gltf = await loadGlb(path.join(MODELS_DIR, entry.glb));
  const waist = (entry.yZero ?? '').startsWith('waist');
  const out = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geom = {
      positions: o.geometry.getAttribute('position').array,
      indices: o.geometry.index.array,
      regions: o.geometry.getAttribute('_region').array,
      bind: interleaveVec4(o.geometry, '_bind'),
      bindW: interleaveVec4(o.geometry, '_bindw'),
      refOrigin: [0, waist ? meta.bodyReference.waistY : meta.bodyReference.shoulderY, meta.bodyReference.axisZ],
    };
    out[o.name.replace(entry.meshPrefix, '')] = { geom, constraints: buildConstraints(geom, []) };
  });
  return { entry, waist, sizes: out };
}

async function main() {
  const only = process.argv.slice(2);
  const kinds = Object.keys(meta.garments).filter((k) => !only.length || only.includes(k));
  const rigs = { male: await buildRig('male'), female: await buildRig('female') };
  const profiles = [
    ['A', PROFILES.A], ['B', PROFILES.B], ['C', PROFILES.C],
    ['F1', FEMALE_PROFILES.F1], ['F2', FEMALE_PROFILES.F2], ['F3', FEMALE_PROFILES.F3],
  ];
  const bodies = profiles.map(([key, profile]) => {
    const rig = rigs[profile.gender];
    const influences = axesToInfluences(rig, solveAxes(rig, profile).axes);
    const collider = buildBodyCollider(rig, influences, bodyIndices[profile.gender]);
    collider.refPositions = bodyRef;
    const pos = deformPositions(rig, influences);
    const probe = { grid: buildBodyGrid(pos, 0.03), normals: computeVertexNormals(pos, bodyIndices[profile.gender]) };
    return { key, collider, probe, body: measure(rig, solveAxes(rig, profile).axes) };
  });

  const failures = [];
  for (const kind of kinds) {
    const { entry, waist, sizes } = await loadKind(kind);
    const fabric = FABRICS[FABRIC_OF[kind] ?? 'knit'];
    console.log(`\n== ${kind} (${entry.label}) vai=${FABRIC_OF[kind]}`);
    for (const size of Object.keys(sizes)) {
      const { geom, constraints } = sizes[size];
      const row = [];
      for (const { key, collider, probe, body } of bodies) {
        const fitKey = entry.fitKey ?? 'chestCircCm';
        const ease = (entry.sizes[size]?.[fitKey] ?? 0) - (fitKey === 'waistCircCm' ? body.waist : body.chest);
        // Cung nguong voi nhan "Chật" o trang thu (ease < 5cm).
        const tight = verdictForEase(ease) === 'chat';
        const anchorY = waist ? collider.waistY : collider.shoulderY;
        const state = createSimState(geom, collider, constraints, 0.014, entry.pinRegion, anchorY);
        for (let s = 0; s < STEPS; s++) stepGarmentSim(state, constraints, collider, { fabric });
        const P = state.positions;
        const n = P.length / 3;
        const problems = [];

        if (P.some((v) => !Number.isFinite(v))) problems.push('NaN');
        let orphan = 0;
        for (let v = 0; v < n; v++) if (!Number.isFinite(state.tetherRest[v])) orphan++;
        if (orphan) problems.push(`roi ${orphan} dinh`);

        let inside = 0, judged = 0, maxIn = 0, worstIn = -1;
        for (let v = 0; v < n; v++) {
          const sd = signedDistance(probe.grid, probe.normals, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (sd === null) continue;
          judged++;
          if (sd < 0) {
            inside++;
            if (-sd > maxIn) { maxIn = -sd; worstIn = state.regions[v]; }
          }
        }
        const inPct = judged ? (inside / judged) * 100 : 0;
        if (maxIn * 100 > MAX_INSIDE_CM || inPct > MAX_INSIDE_PCT)
          problems.push(`xuyen ${(maxIn * 100).toFixed(1)}cm ${inPct.toFixed(0)}% @vung${worstIn}`);

        const { edges, restLengths } = constraints;
        let maxRatio = 0, worstEdge = -1;
        for (let e = 0; e < restLengths.length; e++) {
          const a = edges[e * 2], b = edges[e * 2 + 1];
          if (state.pinned?.[a] && state.pinned?.[b]) continue;
          if (restLengths[e] < MIN_REST_M) continue;
          const len = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
          const r = len / Math.max(1e-6, restLengths[e]);
          if (r > maxRatio) { maxRatio = r; worstEdge = a; }
        }
        if (maxRatio > MAX_EDGE_RATIO && !tight)
          problems.push(`gian ${maxRatio.toFixed(2)}x @vung${state.regions[worstEdge]} y=${P[worstEdge * 3 + 1].toFixed(2)}`);

        row.push(problems.length ? `${key}:✗` : tight ? `${key}:chat` : `${key}:ok`);
        if (problems.length) failures.push({ kind, size, key, problems });
      }
      console.log(`  ${size.padEnd(3)} ${row.join(' ')}`);
    }
  }

  console.log(`\n${failures.length} truong hop loi`);
  for (const f of failures) console.log(`  ${f.kind} ${f.size} ${f.key}: ${f.problems.join('; ')}`);
  console.log('Vung:', JSON.stringify(meta.garments.tshirt.regions), JSON.stringify(meta.garments.pants.regions));
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
