/**
 * Tao dang (pose) cho avatar bang bo xuong MakeHuman (avatar-rig-*.json, xem
 * tools/avatar-pipeline/build_avatar_rig.py).
 *
 * Avatar khong co skin trong GLB, nen skin tuyen tinh lam tren CPU: dau xuong
 * lay tu chinh luoi da morph (khop xuong la to hop dinh luoi), xoay xuong theo
 * dang chon, moi dinh = sum w_k * M_k * p. Ket qua dung cho ca luoi hien thi va
 * bo va cham cua vai -- vai tu ru theo dang moi.
 */

export interface RigJoint {
  idx: number[];
  w: number[];
  off: [number, number, number];
}
export interface RigBone {
  name: string;
  parent: number;
  head: RigJoint;
  tail: RigJoint;
}
export interface AvatarRig {
  skinK: number;
  bones: RigBone[];
  skinIndex: number[];
  skinWeight: number[];
}

type Axis = 'x' | 'y' | 'z';
/** Goc xoay (do) quanh truc THE GIOI o tu the nghi, tinh tu dau xuong. */
type BoneTurn = [bone: string, axis: Axis, deg: number][];

export type PoseKey = 'apose' | 'relaxed' | 'hips' | 'walk' | 'wave';

// Quy uoc: .L o +x (tay trai nhan vat), mat truoc +z. Tu the nghi la chu A
// (tay chech xuong ~50 do). Xoay quanh z am o tay .L = khep tay xuong.
export const POSES: Record<PoseKey, { label: string; turns: BoneTurn }> = {
  apose: { label: 'Chữ A', turns: [] },
  relaxed: {
    label: 'Tay xuôi',
    turns: [
      ['upperarm01.L', 'z', -40], ['upperarm01.R', 'z', 40],
      ['lowerarm01.L', 'x', -12], ['lowerarm01.R', 'x', -12],
    ],
  },
  hips: {
    label: 'Chống hông',
    // Goc do tools/avatar-pipeline/pose_search.mjs do ra: co tay cach hong ~1.5cm,
    // khuyu chia ra ngoai (x ~0.35m). Tay phai doi xung.
    turns: [
      ['upperarm01.L', 'z', -5], ['upperarm01.R', 'z', 5],
      ['lowerarm01.L', 'z', -100], ['lowerarm01.R', 'z', 100],
      ['lowerarm01.L', 'y', 60], ['lowerarm01.R', 'y', -60],
    ],
  },
  walk: {
    label: 'Bước đi',
    turns: [
      ['upperleg01.L', 'x', -18], ['upperleg01.R', 'x', 12],
      ['lowerleg01.R', 'x', 22],
      ['upperarm01.L', 'z', -33], ['upperarm01.R', 'z', 33],
      ['upperarm01.L', 'x', 14], ['upperarm01.R', 'x', -16],
      ['lowerarm01.L', 'x', -10], ['lowerarm01.R', 'x', -18],
    ],
  },
  wave: {
    label: 'Vẫy tay',
    turns: [
      ['upperarm01.L', 'z', -33],
      ['lowerarm01.L', 'x', -10],
      ['upperarm01.R', 'z', -75],
      ['lowerarm01.R', 'z', -70],
    ],
  },
};

type M4 = Float64Array; // column-major 4x4

function identity(): M4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
function mul(a: M4, b: M4): M4 {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
/** Xoay goc rad quanh truc (ux,uy,uz) di qua diem p. */
function rotateAbout(p: number[], u: number[], rad: number): M4 {
  const [x, y, z] = u;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const t = 1 - c;
  const r = identity();
  r[0] = t * x * x + c; r[4] = t * x * y - s * z; r[8] = t * x * z + s * y;
  r[1] = t * x * y + s * z; r[5] = t * y * y + c; r[9] = t * y * z - s * x;
  r[2] = t * x * z - s * y; r[6] = t * y * z + s * x; r[10] = t * z * z + c;
  const tr = identity();
  tr[12] = p[0]; tr[13] = p[1]; tr[14] = p[2];
  const back = identity();
  back[12] = -p[0]; back[13] = -p[1]; back[14] = -p[2];
  return mul(tr, mul(r, back));
}

function jointPos(j: RigJoint, pos: ArrayLike<number>): number[] {
  const out = [j.off[0], j.off[1], j.off[2]];
  for (let k = 0; k < j.idx.length; k++) {
    const i = j.idx[k] * 3;
    out[0] += j.w[k] * pos[i];
    out[1] += j.w[k] * pos[i + 1];
    out[2] += j.w[k] * pos[i + 2];
  }
  return out;
}

const AXES: Record<Axis, number[]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** Tra ve luoi da tao dang (mang moi); pose 'apose' tra lai ban sao. */
export function applyPose(rig: AvatarRig, positions: Float32Array, pose: PoseKey): Float32Array {
  const turns = POSES[pose].turns;
  if (!turns.length) return new Float32Array(positions);

  const byBone = new Map<number, [Axis, number][]>();
  const nameIdx = new Map(rig.bones.map((b, i) => [b.name, i]));
  for (const [name, axis, deg] of turns) {
    const i = nameIdx.get(name);
    if (i === undefined) continue;
    if (!byBone.has(i)) byBone.set(i, []);
    byBone.get(i)!.push([axis, deg]);
  }

  // Bones are stored parent-first, so one pass composes the chain.
  const mats: M4[] = new Array(rig.bones.length);
  for (let b = 0; b < rig.bones.length; b++) {
    const bone = rig.bones[b];
    let m = bone.parent >= 0 ? mats[bone.parent] : identity();
    const own = byBone.get(b);
    if (own) {
      const head = jointPos(bone.head, positions);
      for (const [axis, deg] of own) m = mul(m, rotateAbout(head, AXES[axis], (deg * Math.PI) / 180));
    }
    mats[b] = m;
  }

  const n = positions.length / 3;
  const out = new Float32Array(positions.length);
  const K = rig.skinK;
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < K; k++) {
      const w = rig.skinWeight[v * K + k];
      if (!w) continue;
      const m = mats[rig.skinIndex[v * K + k]];
      ox += w * (m[0] * x + m[4] * y + m[8] * z + m[12]);
      oy += w * (m[1] * x + m[5] * y + m[9] * z + m[13]);
      oz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    out[v * 3] = ox;
    out[v * 3 + 1] = oy;
    out[v * 3 + 2] = oz;
  }
  return out;
}
