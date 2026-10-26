import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPose, POSES } from '../../src/lib/avatar/pose.ts';
const b = readFileSync('public/models/avatar-male.glb');
const g = await new Promise((r, j) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j));
let m; g.scene.traverse((o) => { if (!m && o.isMesh) m = o; });
const pos = Float32Array.from(m.geometry.getAttribute('position').array);
const rig = JSON.parse(readFileSync('public/models/avatar-rig-male.json', 'utf8'));
const B = Object.fromEntries(rig.bones.map((x) => [x.name, x]));
const jp = (j) => [0, 1, 2].map((a) => j.off[a] + j.idx.reduce((s, i, k) => s + j.w[k] * pos[i * 3 + a], 0));
const nearV = (p) => { let best = 0, d = 1e9; for (let v = 0; v < pos.length / 3; v++) { const dd = Math.hypot(pos[v*3]-p[0], pos[v*3+1]-p[1], pos[v*3+2]-p[2]); if (dd < d) { d = dd; best = v; } } return best; };
const wrist = nearV(jp(B['lowerarm02.L'].tail)), elbow = nearV(jp(B['lowerarm01.L'].head));
// hip side vertex: max x at y~0.98
let hip = 0, hx = -1; for (let v = 0; v < pos.length / 3; v++) if (Math.abs(pos[v*3+1] - 0.98) < 0.01 && Math.abs(pos[v*3+2]) < 0.06 && pos[v*3] > hx && pos[v*3] < 0.25) { hx = pos[v*3]; hip = v; }
const H = [pos[hip*3] + 0.03, pos[hip*3+1], pos[hip*3+2]];
console.log('hip target', H.map(x => x.toFixed(3)));
let best = [1e9];
for (const uz of [-5, -15, -25]) for (const uy of [0, 20, 40, 60]) for (const lz of [-60, -80, -100, -120]) for (const ly of [0, 30, 60, 90]) {
  POSES.hips.turns = [['upperarm01.L', 'z', uz], ['upperarm01.L', 'y', uy], ['lowerarm01.L', 'z', lz], ['lowerarm01.L', 'y', ly]];
  const P = applyPose(rig, pos, 'hips');
  const w = [P[wrist*3], P[wrist*3+1], P[wrist*3+2]], e = [P[elbow*3], P[elbow*3+1], P[elbow*3+2]];
  const cost = Math.hypot(w[0]-H[0], w[1]-H[1], w[2]-H[2]) + 0.3 * Math.max(0, 0.30 - e[0]);
  if (cost < best[0]) best = [cost, uz, uy, lz, ly, w.map(x=>x.toFixed(2)).join(','), e.map(x=>x.toFixed(2)).join(',')];
}
console.log(best);
