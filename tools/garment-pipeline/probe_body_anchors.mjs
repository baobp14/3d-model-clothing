// Derives the body anchor geometry the garment pipeline needs: shoulder line,
// arm axis direction (the base mesh is in an A-pose, so sleeves must follow
// that angle), arm radii, and which way is "front".
//
// Run: node --experimental-strip-types tools/garment-pipeline/probe_body_anchors.mjs
// The printed constants get pasted into build_garment_glb.py.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMorphRig, solveAxes, axesToInfluences } from '../../src/lib/avatar/avatarMorphService.ts';
import { PROFILES } from '../../src/lib/avatar/bodyProfiles.ts';
import { deformPositions } from '../../src/lib/tryon/garmentFit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../..', 'public', 'models');

function loadGlb(filePath) {
  const buffer = readFileSync(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

async function buildRig(gender) {
  const gltf = await loadGlb(path.join(MODELS_DIR, `avatar-${gender}.glb`));
  let mesh = null;
  gltf.scene.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o;
  });
  const metadata = JSON.parse(readFileSync(path.join(MODELS_DIR, 'avatar-metadata.json'), 'utf-8'));
  const position = mesh.geometry.getAttribute('position').array;
  const morphDeltas = metadata.morphOrder.map((_, i) => mesh.geometry.morphAttributes.position[i].array);
  return { rig: createMorphRig({ position, morphDeltas }, metadata, gender), metadata };
}

function ringStats(pos, ring) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of ring) {
    cx += pos[v * 3];
    cy += pos[v * 3 + 1];
    cz += pos[v * 3 + 2];
  }
  const n = ring.length;
  cx /= n;
  cy /= n;
  cz /= n;
  let r = 0;
  for (const v of ring) {
    r += Math.hypot(pos[v * 3] - cx, pos[v * 3 + 1] - cy, pos[v * 3 + 2] - cz);
  }
  return { c: [cx, cy, cz], radius: r / n };
}

const f3 = (a) => '[' + a.map((v) => v.toFixed(4)).join(', ') + ']';

async function main() {
  const { rig, metadata } = await buildRig('male');
  console.log('measureRings available:', Object.keys(metadata.measureRings).join(', '));

  const solved = solveAxes(rig, PROFILES.B);
  const pos = deformPositions(rig, axesToInfluences(rig, solved.axes));

  const acroL = rig.landmarks.acromionLeft;
  const acroR = rig.landmarks.acromionRight;
  const pL = [pos[acroL * 3], pos[acroL * 3 + 1], pos[acroL * 3 + 2]];
  const pR = [pos[acroR * 3], pos[acroR * 3 + 1], pos[acroR * 3 + 2]];
  console.log('\nProfile B (175 cm), metres:');
  console.log('  acromion L      ', f3(pL));
  console.log('  acromion R      ', f3(pR));
  console.log('  shoulder line y ', ((pL[1] + pR[1]) / 2).toFixed(4));

  for (const name of ['upperarm', 'lowerarm']) {
    const ring = rig.rings[name];
    if (!ring) {
      console.log(`  ${name}: ring missing`);
      continue;
    }
    const s = ringStats(pos, ring);
    console.log(`  ${name.padEnd(9)} centre ${f3(s.c)}  radius ${s.radius.toFixed(4)}`);
  }

  // Arm axis: acromion (whichever side the rings sit on) -> upperarm centre.
  const ua = ringStats(pos, rig.rings.upperarm);
  const la = ringStats(pos, rig.rings.lowerarm);
  const near = ua.c[0] < 0 ? pL : pR;
  const shoulder = near[0] < 0 ? pL : pR;
  const axis = [ua.c[0] - shoulder[0], ua.c[1] - shoulder[1], ua.c[2] - shoulder[2]];
  const len = Math.hypot(...axis);
  const unit = axis.map((v) => v / len);
  const angleFromVertical = (Math.acos(-unit[1]) * 180) / Math.PI;
  console.log('\n  arm side sampled by rings:', ua.c[0] < 0 ? 'LEFT (-x)' : 'RIGHT (+x)');
  console.log('  shoulder -> upperarm unit', f3(unit));
  console.log('  angle from straight down  ', angleFromVertical.toFixed(1), 'deg');

  const forearm = [la.c[0] - ua.c[0], la.c[1] - ua.c[1], la.c[2] - ua.c[2]];
  const flen = Math.hypot(...forearm);
  console.log('  upperarm -> lowerarm unit ', f3(forearm.map((v) => v / flen)));

  // Which way is front: the chest ring's max-Z side is the chest.
  const chest = ringStats(pos, rig.rings.chest);
  let maxZ = -Infinity;
  let minZ = Infinity;
  for (const v of rig.rings.chest) {
    const z = pos[v * 3 + 2];
    if (z > maxZ) maxZ = z;
    if (z < minZ) minZ = z;
  }
  console.log('\n  chest ring centre', f3(chest.c));
  console.log('  chest z range    ', minZ.toFixed(4), '..', maxZ.toFixed(4), ' -> front is +Z');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
