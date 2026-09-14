// Headless garment drape report. Same data path as the browser: real avatar
// GLB + real garment GLB, real cloth solver, no mocking.
// Run: node --experimental-strip-types tools/garment-pipeline/fit_report.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createMorphRig,
  solveAxes,
  measure,
  axesToInfluences,
} from '../../src/lib/avatar/avatarMorphService.ts';
import { PROFILES, FEMALE_PROFILES } from '../../src/lib/avatar/bodyProfiles.ts';
import {
  buildBodyCollider,
  buildConstraints,
  createSimState,
  setBodyYaw,
  stepGarmentSim,
  settleGarment,
  verdictForEase,
  deformPositions,
  GARMENT_REGION,
  FABRICS,
} from '../../src/lib/tryon/garmentFit.ts';
import { buildBodyGrid, computeVertexNormals, signedDistance } from './bodyProbe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../..', 'public', 'models');

function loadGlb(filePath) {
  const buffer = readFileSync(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
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
  const morphDeltas = metadata.morphOrder.map(
    (_, i) => mesh.geometry.morphAttributes.position[i].array,
  );
  bodyIndices[gender] = mesh.geometry.index.array;
  return createMorphRig({ position, morphDeltas }, metadata, gender);
}

async function loadGarments() {
  const gltf = await loadGlb(path.join(MODELS_DIR, 'garment-tshirt.glb'));
  const meta = JSON.parse(readFileSync(path.join(MODELS_DIR, 'garment-metadata.json'), 'utf-8'));
  const out = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const region = o.geometry.getAttribute('_region');
    if (!region) throw new Error(`${o.name}: missing _REGION attribute -- rerun garment:build`);
    const size = o.name.replace('tshirt_', '');
    const geom = {
      positions: o.geometry.getAttribute('position').array,
      indices: o.geometry.index.array,
      regions: region.array,
    };
    out[size] = { geom, constraints: buildConstraints(geom, meta.sizes[size]?.seams ?? []) };
  });
  return { garments: out, meta };
}

async function main() {
  const rigs = { male: await buildRig('male'), female: await buildRig('female') };
  const { garments, meta } = await loadGarments();
  const REGION_BY_ID = Object.entries(meta.regions).reduce((acc, [k, v]) => {
    acc[v] = k;
    return acc;
  }, {});

  const cases = [
    ['A', PROFILES.A],
    ['B', PROFILES.B],
    ['C', PROFILES.C],
    ['F1', FEMALE_PROFILES.F1],
    ['F2', FEMALE_PROFILES.F2],
    ['F3', FEMALE_PROFILES.F3],
  ];

  let failed = false;
  const collected = [];
  const orphans = new Set();

  for (const [key, profile] of cases) {
    const rig = rigs[profile.gender];
    const solved = solveAxes(rig, profile);
    const body = measure(rig, solved.axes);
    const influences = axesToInfluences(rig, solved.axes);
    const collider = buildBodyCollider(rig, influences, bodyIndices[profile.gender]);

    // Independent verifier: same idea, finer grid than the solver uses (3 cm /
    // 2 cells vs 5 cm / 1 cell), so it can catch contacts the solver's coarser
    // query missed instead of agreeing with it by construction.
    const bodyPos = deformPositions(rig, influences);
    const probe = {
      grid: buildBodyGrid(bodyPos, 0.03),
      normals: computeVertexNormals(bodyPos, bodyIndices[profile.gender]),
    };

    console.log(`\n${key} (${profile.label})  nguc = ${body.chest.toFixed(1)} cm`);
    console.log(
      '  size | ao   | ease  | verdict | gian>tran  | gap TB  | gau tut | cham |   ms | an vao nguoi (do doc lap)',
    );
    console.log(
      '  -----|------|-------|---------|------------|---------|---------|------|------|--------------------------',
    );

    for (const size of meta.sizeOrder) {
      const g = garments[size];
      if (!g) {
        console.log(`  ${size}: MISSING MESH`);
        failed = true;
        continue;
      }

      const t0 = performance.now();
      const { state, report } = settleGarment(g.geom, g.constraints, collider, {
        fabric: FABRICS.knit,
      });
      const ms = performance.now() - t0;

      for (let v = 0; v < state.tetherRest.length; v++) {
        if (!Number.isFinite(state.tetherRest[v])) {
          orphans.add(size);
          break;
        }
      }
      if (state.positions.some((v) => !Number.isFinite(v))) {
        console.log(`  ${size}: non-finite positions after settle`);
        failed = true;
      }

      let inside = 0;
      let maxIn = 0;
      let worst = '-';
      let judged = 0;
      for (let v = 0; v < state.positions.length / 3; v++) {
        const sd = signedDistance(
          probe.grid,
          probe.normals,
          state.positions[v * 3],
          state.positions[v * 3 + 1],
          state.positions[v * 3 + 2],
        );
        if (sd === null) continue;
        judged++;
        if (sd < 0) {
          inside++;
          if (-sd > maxIn) {
            maxIn = -sd;
            worst = REGION_BY_ID[state.regions[v]];
          }
        }
      }
      const insidePct = judged ? (inside / judged) * 100 : 0;

      const ease = meta.sizes[size].chestCircCm - body.chest;
      collected.push({ key, size, ease, insideCm: maxIn * 100, insidePct, ...report });

      console.log(
        `  ${size.padEnd(4)} | ${meta.sizes[size].chestCircCm.toFixed(0).padStart(4)} | ` +
          `${((ease >= 0 ? '+' : '') + ease.toFixed(1)).padStart(5)} | ` +
          `${verdictForEase(ease).padEnd(7)} | ` +
          `${report.maxStretch.toFixed(2).padStart(5)} ${(report.overStretchedFraction * 100).toFixed(1).padStart(4)}% | ` +
          `${report.meanGapCm.toFixed(2).padStart(6)}cm | ` +
          `${report.hemDropCm.toFixed(1).padStart(6)}cm | ` +
          `${(report.contactFraction * 100).toFixed(0).padStart(3)}% | ` +
          `${ms.toFixed(0).padStart(4)} | ` +
          `${(maxIn * 100).toFixed(1)}cm ${insidePct.toFixed(0)}% @${worst}`,
      );
    }
  }

  // --- Quan tinh khi xoay nguoi ---------------------------------------------
  // Cloth is simulated in world space while the body turns underneath it, so
  // the hem should lag and flare outward. Measured, not eyeballed.
  // Do tren AO RONG (nguoi om A + size XL), khong phai ao vua. Ao bo thi
  // bam chat vao nguoi, khong con vai thua de van ra -- do quan tinh tren
  // no la do sai thu. Nguong cu 0.3 cm cung dat tu hoi ao con lo lung ben
  // trong co the, khi con so nay chua co y nghia.
  {
    const profile = PROFILES.A;
    const rig = rigs[profile.gender];
    const solved = solveAxes(rig, profile);
    const collider = buildBodyCollider(
      rig,
      axesToInfluences(rig, solved.axes),
      bodyIndices[profile.gender],
    );
    const g = garments.XL;

    const hemRadius = (state) => {
      let sum = 0;
      let count = 0;
      for (let v = 0; v < state.regions.length; v++) {
        if (state.regions[v] !== GARMENT_REGION.hem) continue;
        sum += Math.hypot(state.positions[v * 3], state.positions[v * 3 + 2]);
        count++;
      }
      return count ? (sum / count) * 100 : 0;
    };

    const state = createSimState(g.geom, collider, g.constraints);
    collider.yaw = 0;
    for (let i = 0; i < 240; i++) {
      stepGarmentSim(state, g.constraints, collider, { fabric: FABRICS.knit });
    }
    const restR = hemRadius(state);

    const dt = 1 / 60;
    let yaw = 0;
    for (let i = 0; i < 120; i++) {
      yaw += 5.5 * dt;
      collider.yaw = yaw;
      setBodyYaw(state, yaw);
      stepGarmentSim(state, g.constraints, collider, { fabric: FABRICS.knit, dt });
    }
    const flare = hemRadius(state) - restR;
    const ok = flare > 0.2;

    console.log('\n--- Quan tinh (nguoi om A + ao rong XL) ---');
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  Xoay 5.5 rad/s => ta ao van ra` +
        `  [gau ${restR.toFixed(2)} cm, van ${flare >= 0 ? '+' : ''}${flare.toFixed(2)} cm]`,
    );
    if (!ok) failed = true;
  }

  console.log('\n--- Kiem chung hanh vi ---');

  const pick = (k, s) => collected.find((r) => r.key === k && r.size === s);
  const worstInside = collected.reduce((m, r) => Math.max(m, r.insideCm), 0);
  const worstInsidePct = collected.reduce((m, r) => Math.max(m, r.insidePct), 0);

  const checks = [
    [
      'Mesh ao lien khoi (khong con manh roi)',
      orphans.size === 0,
      orphans.size ? [...orphans].join(', ') : 'moi dinh noi duoc ve vai',
    ],
    [
      'Ao khong an vao nguoi (sau <= 1.5 cm va dien tich <= 5%)',
      worstInside <= 1.5 && worstInsidePct <= 5,
      `sau nhat ${worstInside.toFixed(1)}cm, dien tich lon nhat ${worstInsidePct.toFixed(0)}%`,
    ],
    [
      'Nguoi om + ao to => vai rot xuong, ho nhieu',
      pick('A', 'XL')?.meanGapCm > 1.5 && pick('A', 'XL')?.hemDropCm > 1,
      `gap=${pick('A', 'XL')?.meanGapCm.toFixed(2)}cm hemDrop=${pick('A', 'XL')?.hemDropCm.toFixed(1)}cm`,
    ],
    [
      'Nguoi to + ao nho => vai bi keo gian',
      pick('C', 'S')?.maxStretch > 1.05,
      `maxStretch=${pick('C', 'S')?.maxStretch.toFixed(3)}`,
    ],
    [
      'Ao to ho hon ao vua tren cung nguoi (A: XL > S)',
      pick('A', 'XL')?.meanGapCm > pick('A', 'S')?.meanGapCm,
      `XL=${pick('A', 'XL')?.meanGapCm.toFixed(2)} vs S=${pick('A', 'S')?.meanGapCm.toFixed(2)}`,
    ],
    [
      'Ao nho bo sat hon ao to (C: S cham nhieu hon XL)',
      pick('C', 'S')?.contactFraction >= pick('C', 'XL')?.contactFraction,
      `S=${(pick('C', 'S')?.contactFraction * 100).toFixed(0)}% vs XL=${(pick('C', 'XL')?.contactFraction * 100).toFixed(0)}%`,
    ],
  ];

  for (const [label, ok, detail] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failed = true;
  }

  console.log(
    '\nNguong ease (cm): chat < 5 <= vua <= 13 < rong. Verdict tinh tu chu vi, doc lap solver.',
  );
  console.log(
    'Do an vao nguoi bang bodyProbe.mjs: luoi 3cm/2 o, min hon luoi 5cm/1 o cua solver.',
  );
  if (failed) {
    console.error('\nFAILED');
    process.exit(1);
  }
  console.log('Drape report OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
