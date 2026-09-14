// Headless solver accuracy report. Imports avatarMorphService.ts directly
// (Node's --experimental-strip-types erases the TS types, no build step, no
// mocking) and runs it against the built GLB + metadata, exactly the data
// path the browser UI uses. Run with: node tools/avatar-pipeline/solve_report.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMorphRig, solveAxes } from '../../src/lib/avatar/avatarMorphService.ts';
import { PROFILES, FEMALE_PROFILES } from '../../src/lib/avatar/bodyProfiles.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');

function loadGlb(filePath) {
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
}

function findMesh(scene) {
  let mesh = null;
  scene.traverse((obj) => {
    if (!mesh && obj.isMesh) mesh = obj;
  });
  return mesh;
}

async function buildRig(gender) {
  const gltf = await loadGlb(path.join(MODELS_DIR, `avatar-${gender}.glb`));
  const mesh = findMesh(gltf.scene);
  const geom = mesh.geometry;
  const metadata = JSON.parse(readFileSync(path.join(MODELS_DIR, 'avatar-metadata.json'), 'utf-8'));

  const position = geom.getAttribute('position').array;
  const morphDeltas = metadata.morphOrder.map((_, i) => geom.morphAttributes.position[i].array);

  return createMorphRig({ position, morphDeltas }, metadata, gender);
}

async function main() {
  const rigs = { male: await buildRig('male'), female: await buildRig('female') };

  const cases = [
    ['A', PROFILES.A],
    ['B', PROFILES.B],
    ['C', PROFILES.C],
    ['F1', FEMALE_PROFILES.F1],
    ['F2', FEMALE_PROFILES.F2],
    ['F3', FEMALE_PROFILES.F3],
  ];

  console.log('Profile | maxAbsError (cm) | dimensions (target -> achieved, error)');
  console.log('--------|-------------------|----------------------------------------');

  let anyFailed = false;
  for (const [key, profile] of cases) {
    const rig = rigs[profile.gender];
    const result = solveAxes(rig, profile);
    const flags = [];
    for (const d of result.dimensions) {
      if (d.outOfRange) flags.push(`${d.dimension}:outOfRange`);
      if (d.extrapolated && !d.outOfRange) flags.push(`${d.dimension}:extrapolated`);
    }
    console.log(`${key} (${profile.label})`);
    console.log(`  maxAbsError = ${result.maxAbsError.toFixed(3)} cm${flags.length ? '  [' + flags.join(', ') + ']' : ''}`);
    for (const d of result.dimensions) {
      console.log(
        `    ${d.dimension.padEnd(13)} target=${d.target.toFixed(2).padStart(7)} ` +
        `achieved=${d.achieved.toFixed(2).padStart(7)} error=${d.error.toFixed(3).padStart(7)}` +
        (d.note ? `  (${d.note})` : ''),
      );
    }
    if (result.maxAbsError > 0.5) {
      anyFailed = true;
    }
  }

  console.log('\nReference table (AVATAR_TEST_HANDOFF.md §6): A<=0.06 B<=0.07 C<=0.21 cm; nu F1..F3 <=0.13 cm (residual mostly inseam).');
  if (anyFailed) {
    console.error('\nFAILED: at least one profile exceeded 0.5 cm max abs error.');
    process.exit(1);
  }
  console.log('\nAll profiles within tolerance.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
