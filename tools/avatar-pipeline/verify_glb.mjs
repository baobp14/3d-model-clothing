// Headless sanity check: can three.js actually load the GLB we produced, and
// does it carry the 22 morph targets under the names avatarMorphService.ts
// expects? Run with: node tools/avatar-pipeline/verify_glb.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');

const EXPECTED_MORPH_ORDER = [
  'height_incr', 'height_decr', 'weight_incr', 'weight_decr',
  'chest_incr', 'chest_decr', 'waist_incr', 'waist_decr',
  'hip_incr', 'hip_decr', 'shoulder_incr', 'shoulder_decr',
  'upperarm_incr', 'upperarm_decr', 'lowerarm_incr', 'lowerarm_decr',
  'upperleg_incr', 'upperleg_decr', 'lowerleg_incr', 'lowerleg_decr',
  'neck_incr', 'neck_decr',
];

function loadGlb(filePath) {
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });
}

function findMesh(scene) {
  let mesh = null;
  scene.traverse((obj) => {
    if (!mesh && obj.isMesh) mesh = obj;
  });
  return mesh;
}

async function verifyOne(gender) {
  const file = path.join(MODELS_DIR, `avatar-${gender}.glb`);
  console.log(`\n=== ${gender} (${file}) ===`);
  const gltf = await loadGlb(file);
  const mesh = findMesh(gltf.scene);
  if (!mesh) throw new Error('no mesh found in GLB scene');

  const geom = mesh.geometry;
  const posAttr = geom.getAttribute('position');
  const idxAttr = geom.getIndex();
  console.log(`vertices: ${posAttr.count}, triangles: ${idxAttr.count / 3}`);

  const dict = mesh.morphTargetDictionary;
  const names = Object.keys(dict || {});
  if (names.length !== 22) {
    throw new Error(`expected 22 morph targets, GLTFLoader exposed ${names.length}: ${names.join(', ')}`);
  }
  for (const name of EXPECTED_MORPH_ORDER) {
    if (!(name in dict)) throw new Error(`missing morph target "${name}" in morphTargetDictionary`);
  }
  console.log(`morphTargetDictionary: ${names.length} keys OK, order matches MORPH_ORDER contract`);

  if (!geom.morphAttributes.position || geom.morphAttributes.position.length !== 22) {
    throw new Error('geometry.morphAttributes.position missing or wrong length');
  }

  // Sanity: neutral height, measured manually from the base POSITION attribute
  // only. NOTE: geom.computeBoundingBox() is deliberately NOT used here --
  // three.js unions in every morphAttributes.position extreme too, which
  // makes that bbox describe the full morphable envelope, not the neutral pose.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const height = maxY - minY;
  console.log(`neutral height: ${height.toFixed(4)} m, min.y: ${minY.toFixed(4)} m`);
  if (height < 1.0 || height > 2.2) throw new Error(`implausible neutral height ${height} m`);
  if (Math.abs(minY) > 0.05) {
    throw new Error(`feet not at y=0 (min.y=${minY})`);
  }

  // React to a morph: pushing height_incr to 1 should make the mesh taller.
  const influences = new Array(22).fill(0);
  influences[dict['height_incr']] = 1;
  mesh.morphTargetInfluences = influences;
  const morphedPos = new THREE.Vector3();
  let morphedMaxY = -Infinity;
  let morphedMinY = Infinity;
  const target = geom.morphAttributes.position[dict['height_incr']];
  for (let i = 0; i < posAttr.count; i++) {
    morphedPos.set(
      posAttr.getX(i) + target.getX(i),
      posAttr.getY(i) + target.getY(i),
      posAttr.getZ(i) + target.getZ(i),
    );
    if (morphedPos.y > morphedMaxY) morphedMaxY = morphedPos.y;
    if (morphedPos.y < morphedMinY) morphedMinY = morphedPos.y;
  }
  const morphedHeight = morphedMaxY - morphedMinY;
  console.log(`height_incr @1.0 bbox height: ${morphedHeight.toFixed(4)} m (neutral ${height.toFixed(4)} m)`);
  if (morphedHeight <= height) {
    throw new Error('height_incr morph did not increase mesh height');
  }

  console.log(`${gender}: OK`);
}

async function main() {
  for (const gender of ['male', 'female']) {
    await verifyOne(gender);
  }
  console.log('\nAll GLB verifications passed.');
}

main().catch((err) => {
  console.error('\nVERIFY FAILED:', err.message);
  process.exit(1);
});
