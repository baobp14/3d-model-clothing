'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  axesToInfluences,
  createMorphRig,
  measure,
  solveAxes,
  type AvatarBodyInput,
  type AvatarMetadata,
  type MorphRig,
} from '@/lib/avatar/avatarMorphService';
import { FEMALE_PROFILES, FORM_FIELDS, PROFILES } from '@/lib/avatar/bodyProfiles';
import { applyPose, armMask, handMask, poseMatrices, trunkMask, POSES, type AvatarRig, type PoseKey } from '@/lib/avatar/pose';
import {
  removeGarmentBackground,
  trimToContent,
  blobToTexture,
  averageOpaqueColor,
} from '@/lib/tryon/backgroundRemoval';
import {
  buildBodyCollider,
  deformPositions,
  placeGarment,
  GARMENT_REGION,
  buildConstraints,
  verdictForEase,
  FABRICS,
  type BodyCollider,
  type GarmentConstraints,
  type GarmentGeometry,
} from '@/lib/tryon/garmentFit';
import type { CameraView, FabricPatternKey, GarmentPieceInput } from './GarmentClothCanvas';
import { CLIP_BINS } from './clipProfile';
import { chartForPrint, fitCircCm, meshScale, type BrandChart, type SizeLetter } from '@/lib/tryon/brandSizes';

const GarmentClothCanvas = dynamic(() => import('./GarmentClothCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-stone-400">
      Booting WebGL…
    </div>
  ),
});

const PROFILE_LIST = [
  ['A', PROFILES.A],
  ['B', PROFILES.B],
  ['C', PROFILES.C],
  ['F1', FEMALE_PROFILES.F1],
  ['F2', FEMALE_PROFILES.F2],
  ['F3', FEMALE_PROFILES.F3],
] as const;

const FABRIC_LIST = [
  ['knit', 'Thun (co giãn 20%)'],
  ['woven', 'Sơ mi (3%)'],
  ['denim', 'Denim (1%)'],
] as const;

// Free-form measurement inputs: label + a sane range so a mistyped value does
// not throw the morph solver to its clamp.
// Ranges kept inside what the morph rig + the garment sim hold without the
// cloth stretching past its limit and clipping ("rách áo"). Circumferences top
// out a bit above the largest preset (C: 108 cm chest), not at anatomical
// extremes. Weight is not here -- its range depends on height (see weightBounds).
const MEASURE_FIELDS: Record<
  (typeof FORM_FIELDS)[number],
  { label: string; min: number; max: number }
> = {
  height: { label: 'Chiều cao', min: 140, max: 200 },
  weight: { label: 'Cân nặng (kg)', min: 35, max: 150 },
  chest: { label: 'Vòng ngực', min: 74, max: 118 },
  waist: { label: 'Vòng eo', min: 56, max: 112 },
  hip: { label: 'Vòng mông', min: 80, max: 120 },
  shoulderWidth: { label: 'Rộng vai', min: 33, max: 53 },
  armLength: { label: 'Dài tay', min: 47, max: 72 },
  inseam: { label: 'Dài chân (đũng→gót)', min: 60, max: 92 },
};

// Weight slider bounds follow height so BMI stays in ~15..32 -- past that the
// morph maxes out and the shirt tears.
function weightBounds(heightCm: number): [number, number] {
  const m2 = (heightCm / 100) ** 2;
  return [Math.round(15 * m2), Math.round(32 * m2)];
}
const clampNum = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// The user types only CHIỀU CAO + CÂN NẶNG. Everything else -- the three
// circumferences and the three limb lengths -- is estimated from those two
// (plus gender) and can be pinned by ticking its box.
//
// This is why weight now changes the body: before, chest/waist/hip were their
// own inputs and the solver hit them exactly, so 100 kg with average
// circumferences drew an average torso. Now weight drives the circumferences.
//
// Circumference model: a linear fit through the six canonical bodies
// (A/B/C, F1/F2/F3) -- exact on them, monotonic in weight, rough but
// overridable elsewhere. Limb lengths scale with height only.
const BASIC_FIELDS = ['height', 'weight'] as const;
const DERIVED_FIELDS = [
  'chest',
  'waist',
  'hip',
  'shoulderWidth',
  'armLength',
  'inseam',
] as const;

const CIRC_FIT = {
  male: {
    chest: [164.2, 1.111, -0.844],
    waist: [115.2, 1.111, -0.644],
    hip: [130.8, 0.889, -0.556],
  },
  female: {
    chest: [-48.8, 0.378, 0.711],
    waist: [21.9, 0.711, 0.044],
    hip: [-22.1, 0.533, 0.533],
  },
} as const;

function deriveSecondary(b: {
  gender: 'male' | 'female';
  height: number;
  weight: number;
}): Record<(typeof DERIVED_FIELDS)[number], number> {
  const { height: h, weight: w } = b;
  const step = (n: number, f: (typeof DERIVED_FIELDS)[number]) => {
    const { min, max } = MEASURE_FIELDS[f];
    return Math.min(max, Math.max(min, Math.round(n * 2) / 2));
  };
  const fit = CIRC_FIT[b.gender];
  const chest = fit.chest[0] + fit.chest[1] * w + fit.chest[2] * h;
  const minChest = b.gender === 'female' ? 76 : 84;
  const minWaist = b.gender === 'female' ? 60 : 66;
  const minHip = b.gender === 'female' ? 82 : 84;
  return {
    chest: Math.max(minChest, step(chest, 'chest')),
    waist: Math.max(minWaist, step(fit.waist[0] + fit.waist[1] * w + fit.waist[2] * h, 'waist')),
    hip: Math.max(minHip, step(fit.hip[0] + fit.hip[1] * w + fit.hip[2] * h, 'hip')),
    shoulderWidth: step(
      b.gender === 'male'
        ? 0.25 * h + 0.07 * (chest - 92)
        : 0.225 * h + 0.06 * (chest - 86) + 1,
      'shoulderWidth',
    ),
    armLength: step(0.345 * h, 'armLength'),
    inseam: step(0.46 * h, 'inseam'),
  };
}

interface GarmentEntry {
  glb: string;
  meshPrefix: string;
  label: string;
  yZero: string;
  regions: Record<string, number>;
  pinRegion: number;
  fitKey: string;
  printCalibration?: { scale: number; offsetX?: number; offsetY: number };
  sizes: Record<string, Record<string, number>>;
}

interface GarmentMeta {
  sizeOrder: string[];
  sizes: Record<
    string,
    { chestCircCm: number; bodyLengthCm: number; seams?: Array<[number, number]> }
  >;
  /** Default print zoom / shift baked with the mesh so an upload lands right. */
  printCalibration?: { scale: number; offsetX?: number; offsetY: number };
  garments: Record<string, GarmentEntry>;
  bodyReference?: { file: string; shoulderY: number; waistY: number; axisZ: number };
}

const DEFAULT_CALIB = { scale: 1, offsetX: 0, offsetY: 0 };
type GarmentKind =
  | 'tshirt'
  | 'tank'
  | 'croptop'
  | 'shirt'
  | 'longshirt'
  | 'sweater'
  | 'jacket'
  | 'dress'
  | 'dressskirt'
  | 'pants'
  | 'shorts'
  | 'capri'
  | 'skirt';
const GARMENT_LABEL: Record<GarmentKind, string> = {
  tshirt: 'Áo thun',
  tank: 'Áo Cộc Tay',
  croptop: 'Áo Croptop',
  shirt: 'Áo Sơ Mi',
  longshirt: 'Sơ Mi Dài Tay',
  sweater: 'Áo Len',
  jacket: 'Áo Khoác',
  dress: 'Đầm',
  dressskirt: 'Váy của đầm',
  pants: 'Quần',
  shorts: 'Quần short',
  capri: 'Quần lửng',
  skirt: 'Chân váy',
};

// A top and a bottom are worn together now -- two independent slots instead
// of one "which single garment is on the body" selection. Each slot only
// offers the kinds that fit it.
type Slot = 'top' | 'bottom';
const SLOT_KINDS: Record<Slot, GarmentKind[]> = {
  // Đầm sits in the top slot: its bodice is the croptop mesh and it brings
  // its own skirt (dressskirt) into the bottom slot -- see resolveSlot.
  // Áo len / áo khoác: mesh vẫn build được nhưng tạm ẩn khỏi trang thử.
  // Shirts are hidden until their collar and placket mesh look right.
  top: ['tshirt', 'shirt'],
  bottom: ['pants', 'shorts', 'skirt'],
};
const SLOT_LABEL: Record<Slot, string> = { top: 'Áo', bottom: 'Quần' };

type SizedGeom = Record<string, { geom: GarmentGeometry; constraints: GarmentConstraints }>;

/**
 * _BIND / _BINDW come as several VEC4 attributes (_bind, _bind2, ...) because
 * glTF has no wider vertex type. Stitch them back into K values per vertex.
 */
function interleaveVec4(g: THREE.BufferGeometry, name: string): Float32Array | undefined {
  const parts: ArrayLike<number>[] = [];
  for (let i = 1; ; i++) {
    const a = g.getAttribute(i === 1 ? name : `${name}${i}`);
    if (!a) break;
    parts.push(a.array as ArrayLike<number>);
  }
  if (!parts.length) return undefined;
  const n = parts[0].length / 4;
  const K = parts.length * 4;
  const out = new Float32Array(n * K);
  for (let v = 0; v < n; v++) {
    for (let p = 0; p < parts.length; p++) {
      for (let k = 0; k < 4; k++) out[v * K + p * 4 + k] = parts[p][v * 4 + k];
    }
  }
  return out;
}

type Loaded = {
  rigs: Record<string, MorphRig>;
  avatars: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  garments: Partial<Record<GarmentKind, SizedGeom>>;
  meta: GarmentMeta;
  bodyRef?: Float32Array;
  poseRigs: Record<string, AvatarRig>;
};

/**
 * A stand-in "flat-lay shirt photo": the _ARTUV unwrap projects the whole
 * garment silhouette (sleeve tip to sleeve tip, hem to collar) into [0,1]^2,
 * which is close to square, so the sample is square too. A grid of squares
 * shows at a glance whether the mapping stretches; edge labels show which way
 * is up and which side is the wearer's right.
 */
function makeSamplePrints(): { front: THREE.Texture; back: THREE.Texture } {
  const draw = (label: string, hue: number) => {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;

    g.fillStyle = `hsl(${hue} 45% 88%)`;
    g.fillRect(0, 0, size, size);

    const cell = size / 8;
    g.strokeStyle = `hsl(${hue} 40% 60%)`;
    g.lineWidth = 2;
    for (let p = 0; p <= size; p += cell) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke();
    }

    g.fillStyle = `hsl(${hue} 60% 40%)`;
    g.beginPath();
    g.arc(size / 2, size / 2, cell * 1.4, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 96px system-ui, sans-serif';
    g.fillText(label, size / 2, size / 2);

    g.fillStyle = '#111';
    g.font = 'bold 34px system-ui, sans-serif';
    g.fillText('▲ CO', size / 2, 32);
    g.fillText('▼ GAU', size / 2, size - 32);
    g.fillText('◀ tay trai', size * 0.18, size / 2);
    g.fillText('tay phai ▶', size * 0.82, size / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  return { front: draw('TRUOC', 210), back: draw('SAU', 10) };
}

function Button({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        'rounded border px-2.5 py-1 text-xs transition ' +
        (active
          ? 'border-stone-900 bg-stone-900 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400')
      }
    >
      {children}
    </button>
  );
}

// Built-in shirt prints, pre-cut and pre-trimmed at build time (npm run
// prints:build -> public/prints/). Switching is just a texture swap -- none
// of the WASM background-removal that an upload needs.
type PrintEntry = {
  id: string;
  name: string;
  /** Which mesh this photo was shot for -- the dataset mixes tees, shorts and
   *  long pants in one flat list (see build_prints.mjs's garmentKindOf). Only
   *  ever 'tshirt' | 'pants' | 'shorts': there's no separate photo set for
   *  tank/croptop/shirt, so top-slot kinds all reuse the 'tshirt' photos
   *  (see presetMatchesKind) -- a flat-lay tee photo maps onto any of them
   *  through the same whole-garment _ARTUV unwrap. */
  kind?: GarmentKind;
  front: string;
  back: string | null;
  baseColor: string;
};

// Quần lửng is cut from the same pants mesh, so the pants photos fit it; the
// skirt has no photo set of its own.
// Chan vay va so mi la vai det: vai thun gian 20% lam vay chay luon song va
// so mi mem nhu ao thun.
const DEFAULT_FABRIC: Partial<Record<GarmentKind, keyof typeof FABRICS>> = {
  skirt: 'woven',
  shirt: 'woven',
  longshirt: 'woven',
};

function presetMatchesKind(presetKind: GarmentKind, activeKind: GarmentKind): boolean {
  // No flat-lay photo set fits a dress bodice + skirt pair.
  if (activeKind === 'dress' || activeKind === 'dressskirt') return false;
  if (activeKind === 'shirt' || activeKind === 'longshirt' || activeKind === 'jacket')
    return presetKind === 'shirt';
  if (SLOT_KINDS.top.includes(activeKind)) return presetKind === 'tshirt';
  if (activeKind === 'capri') return presetKind === 'pants';
  return presetKind === activeKind;
}

/**
 * Fabric choices per garment: the surface pattern the shader draws, its
 * colours, and the cloth model the simulator uses for it (denim hangs stiff,
 * jersey clings). Each garment lists only what it is actually made from --
 * a T-shirt is not offered in corduroy, trousers are not offered in jersey rib.
 */
interface TextureOpt {
  key: string;
  label: string;
  pattern: FabricPatternKey;
  color: string;
  color2: string;
  fabric: keyof typeof FABRICS;
}

const KNIT_TOP_TEXTURES: TextureOpt[] = [
  { key: 'cotton', label: 'Cotton trơn', pattern: 'plain', color: '#41599c', color2: '#ffffff', fabric: 'knit' },
  { key: 'melange', label: 'Melange xám', pattern: 'heather', color: '#9a9ca3', color2: '#ffffff', fabric: 'knit' },
  { key: 'stripe', label: 'Sọc ngang', pattern: 'stripeH', color: '#1f2a44', color2: '#f2efe8', fabric: 'knit' },
  { key: 'rib', label: 'Thun gân', pattern: 'rib', color: '#e8e2d6', color2: '#ffffff', fabric: 'knit' },
];
const SHIRT_TEXTURES: TextureOpt[] = [
  { key: 'oxford', label: 'Oxford xanh', pattern: 'oxford', color: '#9fb4d6', color2: '#ffffff', fabric: 'woven' },
  { key: 'poplin', label: 'Poplin trắng', pattern: 'plain', color: '#f1f1ed', color2: '#ffffff', fabric: 'woven' },
  { key: 'pinstripe', label: 'Sọc dọc', pattern: 'pinstripe', color: '#f4f4f1', color2: '#3b5ea8', fabric: 'woven' },
  { key: 'gingham', label: 'Caro nhỏ', pattern: 'gingham', color: '#ffffff', color2: '#b8322a', fabric: 'woven' },
  { key: 'flannel', label: 'Flannel caro', pattern: 'plaid', color: '#8c1d1d', color2: '#e6c07b', fabric: 'woven' },
  { key: 'linen', label: 'Linen be', pattern: 'linen', color: '#d9ccb4', color2: '#ffffff', fabric: 'woven' },
  { key: 'chambray', label: 'Chambray (jean mỏng)', pattern: 'denim', color: '#5b7fae', color2: '#ffffff', fabric: 'woven' },
];
const BOTTOM_TEXTURES: TextureOpt[] = [
  { key: 'denim', label: 'Jean xanh', pattern: 'denim', color: '#2b4a7a', color2: '#ffffff', fabric: 'denim' },
  { key: 'denimBlack', label: 'Jean đen', pattern: 'denim', color: '#2a2c33', color2: '#ffffff', fabric: 'denim' },
  { key: 'khaki', label: 'Kaki be', pattern: 'twill', color: '#c8b48f', color2: '#ffffff', fabric: 'woven' },
  { key: 'khakiOlive', label: 'Kaki rêu', pattern: 'twill', color: '#5e6645', color2: '#ffffff', fabric: 'woven' },
  { key: 'fleece', label: 'Nỉ xám', pattern: 'heather', color: '#8d9097', color2: '#ffffff', fabric: 'knit' },
  { key: 'cord', label: 'Nhung tăm nâu', pattern: 'corduroy', color: '#6b4a33', color2: '#ffffff', fabric: 'woven' },
];
const SKIRT_TEXTURES: TextureOpt[] = [
  { key: 'denim', label: 'Jean', pattern: 'denim', color: '#3a5f93', color2: '#ffffff', fabric: 'denim' },
  { key: 'khaki', label: 'Kaki', pattern: 'twill', color: '#c8b48f', color2: '#ffffff', fabric: 'woven' },
  { key: 'tartan', label: 'Caro tartan', pattern: 'plaid', color: '#283a6b', color2: '#e4c35b', fabric: 'woven' },
  { key: 'cord', label: 'Nhung tăm', pattern: 'corduroy', color: '#7a3b2e', color2: '#ffffff', fabric: 'woven' },
  { key: 'linen', label: 'Linen', pattern: 'linen', color: '#e5dccb', color2: '#ffffff', fabric: 'woven' },
  { key: 'black', label: 'Trơn đen', pattern: 'plain', color: '#22232a', color2: '#ffffff', fabric: 'woven' },
];
const SWEATER_TEXTURES: TextureOpt[] = [
  { key: 'cable', label: 'Len gân kem', pattern: 'rib', color: '#e6dcc8', color2: '#ffffff', fabric: 'knit' },
  { key: 'navy', label: 'Len trơn navy', pattern: 'heather', color: '#2c3a5c', color2: '#ffffff', fabric: 'knit' },
  { key: 'grey', label: 'Len melange xám', pattern: 'heather', color: '#8f9198', color2: '#ffffff', fabric: 'knit' },
  { key: 'stripe', label: 'Len sọc', pattern: 'stripeH', color: '#7a2630', color2: '#efe6d6', fabric: 'knit' },
];
const JACKET_TEXTURES: TextureOpt[] = [
  { key: 'denim', label: 'Khoác jean', pattern: 'denim', color: '#3d5f8f', color2: '#ffffff', fabric: 'denim' },
  { key: 'khaki', label: 'Kaki be', pattern: 'twill', color: '#b9a37c', color2: '#ffffff', fabric: 'denim' },
  { key: 'olive', label: 'Kaki rêu', pattern: 'twill', color: '#4f5a3c', color2: '#ffffff', fabric: 'denim' },
  { key: 'cord', label: 'Nhung tăm nâu', pattern: 'corduroy', color: '#6b4a33', color2: '#ffffff', fabric: 'denim' },
  { key: 'plaid', label: 'Dạ caro', pattern: 'plaid', color: '#3a3f4a', color2: '#9b8b6a', fabric: 'denim' },
];
const DRESS_TEXTURES: TextureOpt[] = [
  { key: 'black', label: 'Trơn đen', pattern: 'plain', color: '#1f2026', color2: '#ffffff', fabric: 'woven' },
  { key: 'linen', label: 'Linen be', pattern: 'linen', color: '#e2d6c0', color2: '#ffffff', fabric: 'woven' },
  { key: 'gingham', label: 'Caro nhỏ', pattern: 'gingham', color: '#ffffff', color2: '#c0413b', fabric: 'woven' },
  { key: 'red', label: 'Thun đỏ', pattern: 'plain', color: '#a3242e', color2: '#ffffff', fabric: 'knit' },
  { key: 'stripe', label: 'Sọc xanh', pattern: 'pinstripe', color: '#f3f1ea', color2: '#3b5ea8', fabric: 'woven' },
];
const TEXTURES: Record<GarmentKind, TextureOpt[]> = {
  sweater: SWEATER_TEXTURES,
  jacket: JACKET_TEXTURES,
  dress: DRESS_TEXTURES,
  dressskirt: DRESS_TEXTURES,
  tshirt: KNIT_TOP_TEXTURES,
  tank: KNIT_TOP_TEXTURES,
  croptop: KNIT_TOP_TEXTURES,
  shirt: SHIRT_TEXTURES,
  longshirt: SHIRT_TEXTURES,
  pants: BOTTOM_TEXTURES,
  shorts: BOTTOM_TEXTURES,
  capri: BOTTOM_TEXTURES,
  skirt: SKIRT_TEXTURES,
};

interface SlotState {
  kind: GarmentKind | null;
  /** Chosen entry of TEXTURES[kind]; null once a photo print replaces it. */
  textureKey: string | null;
  pattern: FabricPatternKey;
  color2: string;
  size: string;
  fabricKey: keyof typeof FABRICS;
  front: THREE.Texture | null;
  back: THREE.Texture | null;
  baseColor: string;
  printScale: number;
  printOffsetY: number;
  presetIdx: number;
  presetAuto: boolean;
}

function makeSlot(kind: GarmentKind | null, calib: { scale: number; offsetY: number }): SlotState {
  const tex = kind ? TEXTURES[kind][0] : null;
  return {
    kind,
    size: 'M',
    fabricKey: tex?.fabric ?? 'knit',
    textureKey: tex?.key ?? null,
    pattern: tex?.pattern ?? 'plain',
    color2: tex?.color2 ?? '#ffffff',
    front: null,
    back: null,
    baseColor: tex?.color ?? '#41599c',
    printScale: calib.scale,
    printOffsetY: calib.offsetY,
    presetIdx: -1,
    presetAuto: false,
  };
}

interface GarmentTestAppProps {
  catalog?: any[];
  onAddToCart?: (data: { items: any[]; buyNow?: boolean }) => void;
}

export default function GarmentTestApp({ catalog = [], onAddToCart }: GarmentTestAppProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed initial avatar body from customer's saved measurements if available
  const [initialUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('nb_measurements');
      if (!raw) return null;
      const m = JSON.parse(raw);
      if (m && (m.height || m.weight)) {
        return {
          gender: (m.gender || 'male') as 'male' | 'female',
          height: Number(m.height) || 172,
          weight: Number(m.weight) || 55,
          chest: m.chest ? Number(m.chest) : undefined,
          waist: m.waist ? Number(m.waist) : undefined,
          hip: (m.hips || m.hip) ? Number(m.hips || m.hip) : undefined,
          shoulderWidth: m.shoulder ? Number(m.shoulder) : undefined,
        };
      }
    } catch {}
    return null;
  });

  // Pick the best calibrated 3D fit model for the customer's size:
  // Male: A (Slim, 165cm, 58kg - fits S/XS), B (Average, 175cm, 68kg - fits M/L), C (Large, 185cm, 82kg - fits XL)
  // Female: F1 (Slim, 155cm, 48kg), F2 (Average, 162cm, 54kg), F3 (Curvy, 170cm, 65kg)
  const [profileKey, setProfileKey] = useState<string>(() => {
    if (!initialUser) return 'B';
    if (initialUser.gender === 'female') {
      if (initialUser.weight <= 50 || initialUser.height <= 158) return 'F1';
      if (initialUser.weight <= 60 || initialUser.height <= 165) return 'F2';
      return 'F3';
    }
    // Male
    if (initialUser.weight <= 62 || initialUser.height <= 172) return 'A';
    if (initialUser.weight <= 78) return 'B';
    return 'C';
  });

  const [pose, setPose] = useState<PoseKey>('apose');
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [custom, setCustom] = useState<AvatarBodyInput>(() => {
    if (initialUser) {
      return {
        ...PROFILES.B,
        gender: initialUser.gender,
        height: initialUser.height,
        weight: initialUser.weight,
      };
    }
    return { ...PROFILES.B };
  });

  // Keep manual overrides false by default so deriveSecondary generates anatomically
  // balanced, non-collapsed 3D avatar morphs.
  const [manual, setManual] = useState<Record<(typeof DERIVED_FIELDS)[number], boolean>>(
    () => Object.fromEntries(DERIVED_FIELDS.map((f) => [f, false])) as Record<
      (typeof DERIVED_FIELDS)[number],
      boolean
    >,
  );
  const clearManual = () =>
    setManual(
      Object.fromEntries(DERIVED_FIELDS.map((f) => [f, false])) as Record<
        (typeof DERIVED_FIELDS)[number],
        boolean
      >,
    );
  const [spinning, setSpinning] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(1.6);
  const [turnNonce, setTurnNonce] = useState(0);
  const [showTop, setShowTop] = useState(true);
  const [showBottom, setShowBottom] = useState(true);
  const [showStretch, setShowStretch] = useState(false);
  const [showFaces, setShowFaces] = useState(false);
  // Brand-scaled meshes, built once per kind/size/chart (constraints are costly).
  const brandGeoms = useRef(new Map<string, { geom: GarmentGeometry; constraints: GarmentConstraints }>());
  const [wireframe, setWireframe] = useState(false);
  const [view, setView] = useState<CameraView>('full');

  // Which slot's controls (món đồ / size / vải / ảnh in) the sidebar is
  // currently showing. Both slots stay worn on the body regardless of which
  // tab is focused -- this only picks which one you're editing.
  const [activeSlot, setActiveSlot] = useState<Slot>('top');
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    top: makeSlot('tshirt', { scale: 0.83, offsetY: -0.03 }),
    bottom: makeSlot('pants', { scale: 0.9, offsetY: 0 }),
  });
  const updateSlot = (slot: Slot, patch: Partial<SlotState>) =>
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));

  const active = slots[activeSlot];
  const activeEntry = active.kind ? loaded?.meta.garments?.[active.kind] : undefined;
  // Which body measurement the ACTIVE slot's garment is sized against --
  // shirts fit off the chest, pants/shorts off the waist. Only governs the
  // "Người mẫu" hint text and the active slot's own size/ease numbers; the
  // other, non-focused slot still fits correctly on its own terms.
  const fitKey = activeEntry?.fitKey ?? 'chestCircCm';
  const calib = activeEntry?.printCalibration ?? loaded?.meta.printCalibration ?? DEFAULT_CALIB;
  // { slot, what } rather than a bare string: a front-photo upload for the
  // bottom slot must not be mistaken for a preset load on the top slot.
  const [printBusy, setPrintBusy] = useState<{ slot: Slot; what: 'front' | 'back' | 'preset' } | null>(
    null,
  );

  const [presets, setPresets] = useState<PrintEntry[]>([]);
  const texCache = useRef(new Map<string, THREE.Texture>());
  // Clicking through the collection fires loadPreset() again before the
  // previous call's texture fetch has resolved, and fetches do not resolve
  // in click order (cache hits are instant, network misses are not). Only the
  // most recently STARTED call for THAT slot may write its result -- one
  // counter per slot so a stale top-slot load can't stomp a fresh bottom-slot
  // one or vice versa.
  const presetRequestId = useRef<Record<Slot, number>>({ top: 0, bottom: 0 });
  // The collection is scoped to whichever kind the active slot has selected.
  // There's only ever a 'tshirt'-tagged photo set (see PrintEntry.kind), so
  // every top-slot kind (áo thun/cộc tay/croptop/sơ mi) reuses it; bottom
  // kinds still match their own tag exactly.
  const kindPresets = useMemo(
    () => (active.kind ? presets.filter((p) => presetMatchesKind(p.kind ?? 'tshirt', active.kind!)) : []),
    [presets, active.kind],
  );

  useEffect(() => {
    let off = false;
    fetch('/prints/manifest.json')
      .then((r) => r.json())
      .then((d) => {
        if (!off && Array.isArray(d.items)) setPresets(d.items);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  // Small LRU so cycling the whole set does not pile ~120 textures into GPU
  // memory. 16 = the 8 most recent shirts, front+back.
  const TEX_CACHE_MAX = 16;
  async function presetTexture(url: string): Promise<THREE.Texture> {
    const cache = texCache.current;
    const hit = cache.get(url);
    if (hit) {
      cache.delete(url);
      cache.set(url, hit); // bump to newest
      return hit;
    }
    const tex = await blobToTexture(await fetch(url).then((r) => r.blob()));
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(url, tex);
    while (cache.size > TEX_CACHE_MAX) {
      const oldest = cache.keys().next().value as string;
      cache.get(oldest)?.dispose();
      cache.delete(oldest);
    }
    return tex;
  }

  // `slot` and `list` are captured at call time, not re-read from live state
  // after the await -- so a slot switch mid-fetch can't make this write to
  // the wrong slot or index into the wrong (now-stale) preset list.
  async function loadPreset(slot: Slot, list: PrintEntry[], idx: number) {
    const entry = list[idx];
    if (!entry) return;
    const requestId = ++presetRequestId.current[slot];
    updateSlot(slot, { presetIdx: idx });
    setPrintBusy({ slot, what: 'preset' });
    try {
      const [f, b] = await Promise.all([
        presetTexture(entry.front),
        entry.back ? presetTexture(entry.back) : Promise.resolve(null),
      ]);
      if (presetRequestId.current[slot] !== requestId) return; // superseded, drop it
      updateSlot(slot, { front: f, back: b, baseColor: entry.baseColor });
    } catch (err) {
      if (presetRequestId.current[slot] !== requestId) return;
      console.error('[garment-test] preset', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (presetRequestId.current[slot] === requestId) setPrintBusy(null);
    }
  }

  // "Mặc thử cả bộ" from the outfit recommender links here as
  // ?top=<print id>&bottom=<print id>: dress both slots in those prints once
  // the meshes and the print manifest are loaded.
  const outfitApplied = useRef(false);
  useEffect(() => {
    if (outfitApplied.current || !loaded || !presets.length) return;
    outfitApplied.current = true;
    const q = new URLSearchParams(window.location.search);
    const urlSize = q.get('size');
    if (urlSize && loaded.meta.sizeOrder.includes(urlSize as any)) {
      updateSlot('top', { size: urlSize as any });
      updateSlot('bottom', { size: urlSize as any });
      // Map chosen size to best authored mannequin model
      if (urlSize === 'S' || urlSize === 'XS') {
        setProfileKey((k) => (k.startsWith('F') ? 'F1' : 'A'));
      } else if (urlSize === 'M' || urlSize === 'L') {
        setProfileKey((k) => (k.startsWith('F') ? 'F2' : 'B'));
      } else if (urlSize === 'XL' || urlSize === '2XL') {
        setProfileKey((k) => (k.startsWith('F') ? 'F3' : 'C'));
      }
    }
    // Women's garments (AS Colour Wo's, Everlane skirts) start on a female body.
    if ([q.get('top'), q.get('bottom')].some((id) => id && (id.includes('_wos_') || id.startsWith('everlane_')))) {
      setCustomMode(false);
      setProfileKey('F2');
    }
    // Opened for one garment (e.g. from a product page): show just that piece.
    if (q.get('top') && !q.get('bottom')) setShowBottom(false);
    if (q.get('bottom') && !q.get('top')) {
      setShowTop(false);
      setActiveSlot('bottom');
    }
    for (const slot of ['top', 'bottom'] as const) {
      const entry = presets.find((p) => p.id === q.get(slot));
      if (!entry) continue;
      const kind: GarmentKind = entry.kind ?? 'tshirt';
      if (!SLOT_KINDS[slot].includes(kind) || !loaded.meta.garments[kind]) continue;
      const c = loaded.meta.garments[kind]?.printCalibration ?? DEFAULT_CALIB;
      const list = presets.filter((p) => presetMatchesKind(p.kind ?? 'tshirt', kind));
      updateSlot(slot, {
        kind,
        fabricKey: DEFAULT_FABRIC[kind] ?? 'knit',
        textureKey: null,
        pattern: 'plain',
        printScale: c.scale,
        printOffsetY: c.offsetY,
      });
      void loadPreset(slot, list, list.indexOf(entry));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, presets]);

  const stepPreset = (delta: number) => {
    if (!kindPresets.length) return;
    const base = active.presetIdx < 0 ? (delta > 0 ? -1 : 0) : active.presetIdx;
    void loadPreset(activeSlot, kindPresets, (base + delta + kindPresets.length) % kindPresets.length);
  };

  // Auto-advance: wait for the current one to finish draping, then move on.
  // Scoped to the active slot/tab only -- switching tabs pauses it rather
  // than advancing a slot you're no longer looking at.
  useEffect(() => {
    if (!active.presetAuto || !kindPresets.length || printBusy) return;
    const t = setTimeout(() => stepPreset(1), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.presetAuto, active.presetIdx, printBusy, kindPresets.length, activeSlot]);

  async function loadPrint(slot: Slot, side: 'front' | 'back', file: File | undefined) {
    if (!file) return;
    setPrintBusy({ slot, what: side });
    try {
      const blob = await removeGarmentBackground(file);
      const trimmed = await trimToContent(blob);
      // Trim the transparent margin so the garment fills the shirt's UV
      // instead of shrinking to a patch in the middle of it.
      const tex = await blobToTexture(trimmed);
      tex.colorSpace = THREE.SRGBColorSpace;
      updateSlot(slot, side === 'front' ? { front: tex } : { back: tex });
      // Tint the bare fabric (sleeves, collar) to the shirt's own colour so
      // it does not read as a contrast panel where the photo runs out.
      if (side === 'front') updateSlot(slot, { baseColor: await averageOpaqueColor(trimmed) });
    } catch (err) {
      console.error('[garment-test] print', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPrintBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loader = new GLTFLoader();
        const metaRes = await fetch('/models/avatar-metadata.json');
        if (!metaRes.ok) throw new Error('avatar-metadata.json missing — run npm run avatar:build');
        const metadata: AvatarMetadata = await metaRes.json();

        const gMetaRes = await fetch('/models/garment-metadata.json');
        if (!gMetaRes.ok) throw new Error('garment-metadata.json missing — run npm run garment:build');
        const meta: GarmentMeta = await gMetaRes.json();

        // Reference body the garments were cut from + where each garment's
        // local origin sits on it (tops: shoulder line, bottoms: waist).
        const refInfo = meta.bodyReference;
        let bodyRef: Float32Array | undefined;
        if (refInfo) {
          const r = await fetch(`/models/${refInfo.file}`);
          if (r.ok) bodyRef = new Float32Array(await r.arrayBuffer());
        }
        const BOTTOM_PREFIXES = ['pants_', 'shorts_', 'capri_', 'skirt_', 'dressskirt_'];
        const originOf = (prefix: string): [number, number, number] | undefined =>
          refInfo
            ? [0, BOTTOM_PREFIXES.includes(prefix) ? refInfo.waistY : refInfo.shoulderY, refInfo.axisZ]
            : undefined;

        const loadGarment = async (url: string, prefix: string): Promise<SizedGeom> => {
          const gltf = await loader.loadAsync(url);
          const out: SizedGeom = {};
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const region = m.geometry.getAttribute('_region');
            const facing = m.geometry.getAttribute('_facing');
            if (!region || !facing) throw new Error(`${m.name}: missing _REGION/_FACING — run npm run garment:build`);
            const geom: GarmentGeometry = {
              positions: m.geometry.attributes.position.array as Float32Array,
              indices: m.geometry.index!.array as Uint32Array,
              regions: region.array as Uint8Array,
              uv: m.geometry.attributes.uv.array as Float32Array,
              artUv: m.geometry.getAttribute('_artuv')?.array as Float32Array | undefined,
              facing: Float32Array.from(facing.array as ArrayLike<number>, (v) =>
                facing.normalized ? v / 255 : v,
              ),
              bind: interleaveVec4(m.geometry, '_bind'),
              bindW: interleaveVec4(m.geometry, '_bindw'),
              refOrigin: originOf(prefix),
            };
            const sizeKey = m.name.replace(prefix, '');
            out[sizeKey] = { geom, constraints: buildConstraints(geom, []) };
          });
          return out;
        };

        const loadAvatarGender = async (gender: 'male' | 'female') => {
          const [gltf, rigRes] = await Promise.all([
            loader.loadAsync(`/models/avatar-${gender}.glb`),
            fetch(`/models/avatar-rig-${gender}.json`).then((r) => (r.ok ? r.json() : null)),
          ]);
          let body: THREE.Mesh | null = null;
          gltf.scene.traverse((o) => {
            if (!body && (o as THREE.Mesh).isMesh) body = o as THREE.Mesh;
          });
          if (!body) throw new Error(`No mesh in avatar-${gender}.glb`);
          const g = (body as THREE.Mesh).geometry;
          const morphs = g.morphAttributes.position;
          if (!morphs) throw new Error(`avatar-${gender}.glb has no position morph targets`);
          const rig = createMorphRig(
            {
              position: Float32Array.from(g.attributes.position.array as Float32Array),
              morphDeltas: morphs.map((a) => a.array as Float32Array),
            },
            metadata,
            gender,
          );
          (body as THREE.Mesh).userData.basePosition = Float32Array.from(
            g.attributes.position.array as Float32Array,
          );
          return {
            gender,
            rig,
            avatar: gltf.scene,
            mesh: body as THREE.Mesh,
            poseRig: rigRes as AvatarRig | null,
          };
        };

        // Determine active gender for fast initial paint
        const startGender: 'male' | 'female' =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('top')?.includes('_wos_')
            ? 'female'
            : (initialUser?.gender || 'male');

        // Fast parallel load: active avatar + core initial garments only (drops initial payload from 15MB to ~5MB)
        const [initGender, tshirt, pants] = await Promise.all([
          loadAvatarGender(startGender),
          loadGarment('/models/garment-tshirt.glb', 'tshirt_'),
          loadGarment('/models/garment-pants.glb', 'pants_'),
        ]);

        const rigs: Record<string, MorphRig> = { [startGender]: initGender.rig };
        const avatars: Record<string, THREE.Object3D> = { [startGender]: initGender.avatar };
        const meshes: Record<string, THREE.Mesh> = { [startGender]: initGender.mesh };
        const poseRigs: Record<string, AvatarRig> = {};
        if (initGender.poseRig) poseRigs[startGender] = initGender.poseRig;

        const garments: Partial<Record<GarmentKind, Awaited<ReturnType<typeof loadGarment>>>> = {
          tshirt,
          pants,
        };

        if (cancelled) return;
        setLoaded({ rigs, avatars, meshes, garments, meta, bodyRef, poseRigs });

        // Non-blocking background prefetch for remaining clothes and other gender avatar
        setTimeout(async () => {
          if (cancelled) return;
          const otherGender = startGender === 'male' ? 'female' : 'male';
          try {
            const [otherGenderData, shirt, longshirt, shorts, skirt] = await Promise.all([
              loadAvatarGender(otherGender),
              loadGarment('/models/garment-shirt.glb', 'shirt_'),
              loadGarment('/models/garment-longshirt.glb', 'longshirt_'),
              loadGarment('/models/garment-shorts.glb', 'shorts_'),
              loadGarment('/models/garment-skirt.glb', 'skirt_'),
            ]);
            if (cancelled) return;
            setLoaded((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                rigs: { ...prev.rigs, [otherGender]: otherGenderData.rig },
                avatars: { ...prev.avatars, [otherGender]: otherGenderData.avatar },
                meshes: { ...prev.meshes, [otherGender]: otherGenderData.mesh },
                poseRigs: otherGenderData.poseRig
                  ? { ...prev.poseRigs, [otherGender]: otherGenderData.poseRig }
                  : prev.poseRigs,
                garments: {
                  ...prev.garments,
                  shirt,
                  longshirt,
                  shorts,
                  skirt,
                },
              };
            });
          } catch (e) {
            console.warn('[garment-test] Background prefetch warning:', e);
          }
        }, 1000);
      } catch (err) {
        if (cancelled) return;
        console.error('[garment-test]', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Each secondary measurement is the anthropometric estimate unless its box is
  // ticked, in which case the typed value in `custom` wins.
  const customResolved = useMemo<AvatarBodyInput>(() => {
    const est = deriveSecondary(custom);
    const out = { ...custom };
    for (const f of DERIVED_FIELDS) if (!manual[f]) out[f] = est[f];
    return out;
  }, [custom, manual]);

  const profile = useMemo<AvatarBodyInput>(
    () => (customMode ? customResolved : PROFILE_LIST.find(([k]) => k === profileKey)![1]),
    [customMode, customResolved, profileKey],
  );

  // Solve the body, push the morphs onto the visible mesh, and rebuild the
  // colliders. Cheap enough to redo whenever the profile changes.
  const scene = useMemo(() => {
    if (!loaded) return null;
    const rig = loaded.rigs[profile.gender];
    if (!rig) return null;
    const solved = solveAxes(rig, profile);
    const influences = axesToInfluences(rig, solved.axes);

    const mesh = loaded.meshes[profile.gender];
    const poseRig = loaded.poseRigs[profile.gender];
    // Posed: skin on the CPU and show the result directly (morphs baked in,
    // influences zeroed). Chữ A: the untouched base + GPU morphs as before.
    const unposed = pose !== 'apose' && poseRig ? deformPositions(rig, influences) : undefined;
    const mats = unposed && poseRig ? poseMatrices(poseRig, unposed, pose) : null;
    const posed = unposed && poseRig ? applyPose(poseRig, unposed, pose) : undefined;
    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const base = mesh.userData.basePosition as Float32Array;
    (posAttr.array as Float32Array).set(posed ?? base);
    posAttr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
    const shown = posed ? new Array(influences.length).fill(0) : Array.from(influences);
    if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== shown.length) {
      mesh.morphTargetInfluences = shown;
    } else {
      for (let i = 0; i < shown.length; i++) mesh.morphTargetInfluences[i] = shown[i];
    }

    const index = mesh.geometry.index;
    if (!index) throw new Error('Body mesh has no index buffer');
    const collider: BodyCollider = buildBodyCollider(
      rig,
      influences,
      index.array,
      0.05,
      posed,
      poseRig ? handMask(poseRig) : undefined,
    );
    collider.yaw = 0;
    collider.refPositions = loaded.bodyRef;
    if (poseRig) {
      collider.armMask = armMask(poseRig);
      collider.trunkMask = trunkMask(poseRig);
    }
    if (unposed && mats && poseRig) {
      collider.unposed = unposed;
      collider.pose = { skinK: poseRig.skinK, skinIndex: poseRig.skinIndex, skinWeight: poseRig.skinWeight, mats };
    }

    // Lowest point of the morphed body = where the floor must sit, otherwise a
    // shorter body hangs above the disc or a taller one sinks through it.
    let groundY = Infinity;
    for (let i = 1; i < collider.positions.length; i += 3) {
      if (collider.positions[i] < groundY) groundY = collider.positions[i];
    }

    return {
      avatar: loaded.avatars[profile.gender],
      colliders: collider,
      groundY,
      body: measure(rig, solved.axes),
      solveError: solved.maxAbsError,
      outOfRange: solved.dimensions
        .filter((d) => d.outOfRange)
        .map((d) => MEASURE_FIELDS[d.dimension as (typeof FORM_FIELDS)[number]]?.label ?? d.dimension),
    };
  }, [loaded, profile, pose]);

  // One resolved { geom, constraints, entry } per slot that currently has a
  // kind chosen -- feeds both the 3D pieces array and each slot's own
  // ease/size numbers.
  const wearingDress = slots.top.kind === 'dress';
  // The print a slot wears decides its brand: its real size chart replaces the
  // generic one, and the base mesh is scaled to the brand's measurements.
  function chartOf(st: SlotState): BrandChart | null {
    if (!st.kind || st.presetIdx < 0) return null;
    const entry = presets.filter((p) => presetMatchesKind(p.kind ?? 'tshirt', st.kind!))[st.presetIdx];
    const chart = chartForPrint(entry?.id);
    return chart && chart.kind === st.kind ? chart : null;
  }
  function brandSized(kind: GarmentKind, size: string, chart: BrandChart, base: { geom: GarmentGeometry; constraints: GarmentConstraints }) {
    const key = `${kind}:${size}:${chart.id}`;
    const hit = brandGeoms.current.get(key);
    if (hit) return hit;
    const { sx, sy } = meshScale(chart, size as SizeLetter, loaded!.meta.garments[kind]!.sizes[size] as unknown as Record<string, number>);
    const positions = new Float32Array(base.geom.positions);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] *= sx;
      positions[i + 1] *= sy;
      positions[i + 2] *= sx;
    }
    const geom = { ...base.geom, positions };
    const out = { geom, constraints: buildConstraints(geom, []) };
    brandGeoms.current.set(key, out);
    return out;
  }
  function resolveSlot(slot: Slot) {
    // A dress fills both slots: the bottom becomes the dress's own skirt, cut
    // from the same cloth and size as its bodice.
    const st: SlotState =
      slot === 'bottom' && wearingDress ? { ...slots.top, kind: 'dressskirt' } : slots[slot];
    if (!loaded || !st.kind) return null;
    const base = loaded.garments[st.kind]?.[st.size];
    if (!base) return null;
    const entry = loaded.meta.garments[st.kind];
    const chart = chartOf(st);
    const sized = chart ? brandSized(st.kind, st.size, chart, base) : base;
    return { state: st, entry, chart, ...sized };
  }
  const topResolved = resolveSlot('top');
  const bottomResolved = resolveSlot('bottom');

  const activeResolved = activeSlot === 'top' ? topResolved : bottomResolved;
  const activeChart = activeResolved?.chart ?? null;
  const garmentCircCm = activeResolved
    ? activeResolved.chart
      ? fitCircCm(activeResolved.chart, activeResolved.state.size as SizeLetter)
      : activeResolved.entry?.sizes[activeResolved.state.size]?.[fitKey]
    : undefined;
  // When customer has saved measurements, assess fit against their actual body
  const customerCirc = initialUser
    ? (fitKey === 'waistCircCm' ? (initialUser.waist ?? scene?.body.waist) : (initialUser.chest ?? scene?.body.chest))
    : undefined;
  const bodyCircCm = customerCirc ?? (scene ? (fitKey === 'waistCircCm' ? scene.body.waist : scene.body.chest) : 0);
  const ease =
    activeResolved && bodyCircCm && garmentCircCm !== undefined ? garmentCircCm - bodyCircCm : null;

  if (error) {
    return <div className="p-6 text-sm text-red-600">Lỗi: {error}</div>;
  }
  if (!loaded || !scene) {
    return (
      <div className="flex h-[calc(100vh-68px)] min-h-[640px] items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center max-w-sm p-8 text-center bg-white rounded-2xl shadow-xs border border-stone-200/80">
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-stone-200 border-t-stone-900 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-stone-900 tracking-tighter">3D</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-stone-900 tracking-tight mb-1">
            Đang chuẩn bị phòng thử đồ 3D
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed mb-4">
            Đang tải mô hình người mẫu giải phẫu học và phom dáng vải vật lý...
          </p>
          <div className="w-40 h-1 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-stone-900 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Match worn clothes to real products from shop catalog
  const topProduct = useMemo(() => {
    if (!catalog || !catalog.length || !showTop) return null;
    const topPreset = presets.filter((p) => presetMatchesKind(p.kind ?? 'tshirt', (slots.top.kind || 'tshirt')))[slots.top.presetIdx];
    const currentPresetId = topPreset?.id || null;
    if (currentPresetId) {
      const match = catalog.find((p: any) => p.images?.some((img: string) => img.includes(currentPresetId)));
      if (match) return match;
    }
    return catalog.find((p: any) => p.category === 'm-tshirts' || p.category === 'w-tshirts') || catalog[0] || null;
  }, [catalog, showTop, presets, slots.top.kind, slots.top.presetIdx]);

  const bottomProduct = useMemo(() => {
    if (!catalog || !catalog.length || !showBottom) return null;
    return (
      catalog.find((p: any) => p.category === 'm-trousers' || p.category === 'w-trousers' || p.category === 'w-skirts') ||
      catalog.find((p: any) => p.category?.includes('trouser')) ||
      null
    );
  }, [catalog, showBottom]);

  const wornItems = useMemo(() => {
    const list: any[] = [];
    if (showTop && topProduct) {
      list.push({
        product: topProduct,
        color: topProduct.colors?.[0] || 'cream',
        size: slots.top.size,
        name: topProduct.name_vi,
        price: topProduct.price || 199000,
        kind: 'Áo',
        fitStatus: verdictForEase(ease ?? 0),
      });
    }
    if (showBottom && bottomProduct) {
      list.push({
        product: bottomProduct,
        color: bottomProduct.colors?.[0] || 'black',
        size: slots.bottom.size,
        name: bottomProduct.name_vi,
        price: bottomProduct.price || 399000,
        kind: 'Quần',
        fitStatus: verdictForEase(ease ?? 0),
      });
    }
    return list;
  }, [showTop, showBottom, topProduct, bottomProduct, slots.top.size, slots.bottom.size, ease]);

  const comboTotal = wornItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const verdict = ease === null ? '' : verdictForEase(ease);
  const verdictLabel: Record<string, string> = {
    chat: 'Chật',
    vua: 'Vừa',
    rong: 'Rộng',
  };

  // The top's hem line all the way round the body, as world Y per angle:
  // the bottom is not drawn above it, since the two cloths do not collide and
  // a waistband under an untucked shirt would saw through it. One flat cut at
  // the lowest hem point left the waistband poking out at the sides, where a
  // curved shirt-tail hem rides higher. Sleeves are left out -- a cuff hanging
  // at hip height is not a hem.
  const topHemProfile = (() => {
    if (!topResolved || !showTop) return undefined;
    const g = topResolved.geom;
    const placed = placeGarment(g, scene.colliders, topResolved.constraints, scene.colliders.shoulderY);
    const prof = new Float32Array(CLIP_BINS).fill(Infinity);
    const hasHemRegion = Array.from(g.regions).some((r) => r === GARMENT_REGION.hem);
    for (let v = 0; v < g.regions.length; v++) {
      const r = g.regions[v];
      if (
        hasHemRegion
          ? r !== GARMENT_REGION.hem
          : (r >= GARMENT_REGION.sleeveRight && r <= GARMENT_REGION.cuffLeft) ||
            placed[v * 3 + 1] > scene.colliders.waistY + 0.05
      )
        continue;
      const x = placed[v * 3];
      const z = placed[v * 3 + 2] - scene.colliders.axisZ;
      const a = (Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2);
      const b = Math.floor((a / (Math.PI * 2)) * CLIP_BINS) % CLIP_BINS;
      prof[b] = Math.min(prof[b], placed[v * 3 + 1]);
    }
    for (let b = 0; b < CLIP_BINS; b++) {
      if (Number.isFinite(prof[b])) continue;
      for (let d = 1; d < CLIP_BINS; d++) {
        const c = prof[(b + d) % CLIP_BINS];
        if (Number.isFinite(c)) {
          prof[b] = c;
          break;
        }
      }
    }
    // Crop tops: if the lowest hem sits completely above the waistband, do not clip the pants
    const minHem = Math.min(...prof);
    if (minHem > scene.colliders.waistY + 0.02) return undefined;

    // Smooth uniform slack so the pants tuck neatly inside without poke-through
    for (let b = 0; b < CLIP_BINS; b++) prof[b] += 0.02;
    return prof;
  })();

  const pieces: GarmentPieceInput[] = [];
  for (const [slot, resolved] of [['top', topResolved], ['bottom', bottomResolved]] as const) {
    if (!resolved) continue;
    pieces.push({
      key: slot,
      slot,
      ease: slot === 'top' ? 0.020 : 0.012,
      geom: resolved.geom,
      constraints: resolved.constraints,
      fabric: FABRICS[resolved.state.fabricKey],
      pinRegion: resolved.entry?.pinRegion ?? 5,
      anchorY: (resolved.entry?.yZero ?? '').startsWith('waist')
        ? scene.colliders.waistY
        : scene.colliders.shoulderY,
      showGarment: slot === 'top' ? showTop : showBottom,
      showStretch: showStretch && slot === activeSlot,
      showFaces: showFaces && slot === activeSlot,
      frontPrint: resolved.state.front,
      backPrint: resolved.state.back,
      baseColor: resolved.state.baseColor,
      printScale: resolved.state.printScale,
      printOffset: [0, resolved.state.printOffsetY],
      placket:
        resolved.state.kind === 'shirt' ||
        resolved.state.kind === 'longshirt' ||
        resolved.state.kind === 'jacket',
      pattern: resolved.state.front || resolved.state.back ? 'plain' : resolved.state.pattern,
      color2: resolved.state.color2,
      // A dress's skirt is the same cloth as its bodice: overlapping is fine,
      // and cutting it under the bodice hem bared the hips.
      clipProfile:
        slot === 'bottom' && resolved.state.kind !== 'dressskirt' ? topHemProfile : undefined,
      clipPull:
        resolved.state.kind === 'skirt' || resolved.state.kind === 'dressskirt' ? 0.035 : 0.012,
    });
  }

  return (
    <div className="flex h-[calc(100vh-68px)] min-h-[640px] flex-col bg-stone-50">


      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 flex flex-col border-r border-stone-200 bg-white overflow-hidden shadow-xs">
          {/* Header Phòng Thử Đồ */}
          <div className="p-4 border-b border-stone-100 bg-stone-50/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-900">
                Phòng thử đồ 3D
              </span>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                Thời gian thực
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Thử nghiệm form dáng & kích thước trực tiếp trên người mẫu mô phỏng.
            </p>
          </div>

          {/* Scrollable Customer Controls */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* 1. CHỌN MÓN ĐỒ (ÁO / QUẦN) */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block mb-2">
                Trang phục đang thử
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl">
                {(['top', 'bottom'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setActiveSlot(s);
                      if (s === 'top') setShowTop(true);
                      if (s === 'bottom') setShowBottom(true);
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg transition-all text-center ${
                      activeSlot === s
                        ? 'bg-white text-stone-900 shadow-xs font-semibold'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {s === 'top' ? '👔 Áo (Tops)' : '👖 Quần (Bottoms)'}
                  </button>
                ))}
              </div>

              {/* Garment item styles (T-Shirt, Shirt, Longshirt, Pants, Shorts, Skirt) */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SLOT_KINDS[activeSlot].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const nextKind = active.kind === k ? null : k;
                      const nextCalib = nextKind
                        ? (loaded.meta.garments[nextKind]?.printCalibration ?? DEFAULT_CALIB)
                        : DEFAULT_CALIB;
                      const tex = nextKind ? TEXTURES[nextKind][0] : null;
                      updateSlot(activeSlot, {
                        kind: nextKind,
                        presetIdx: -1,
                        fabricKey: tex?.fabric ?? (nextKind && DEFAULT_FABRIC[nextKind]) ?? 'knit',
                        printScale: nextCalib.scale,
                        printOffsetY: nextCalib.offsetY,
                        ...(tex
                          ? {
                              textureKey: tex.key,
                              pattern: tex.pattern,
                              baseColor: tex.color,
                              color2: tex.color2,
                              front: null,
                              back: null,
                            }
                          : {}),
                      });
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      active.kind === k
                        ? 'border-stone-900 bg-stone-900 text-white font-medium shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    {GARMENT_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. CHỌN SIZE ÁO / QUẦN (TRỌNG TÂM CHO KHÁCH HÀNG) */}
            {active.kind && (
              <div className="rounded-2xl border-2 border-stone-900/10 bg-stone-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                    Chọn Size {activeSlot === 'top' ? 'Áo' : 'Quần'}
                  </span>
                  <span className="text-xs font-bold text-stone-900 bg-stone-200/80 px-2.5 py-0.5 rounded-full">
                    Size {active.size}
                  </span>
                </div>

                {/* Big Size Grid Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {loaded.meta.sizeOrder.map((s) => {
                    const isSelected = active.size === s;
                    const circ = activeChart
                      ? Math.round(fitCircCm(activeChart, s as SizeLetter) ?? 0)
                      : Math.round(activeEntry?.sizes[s]?.[fitKey] ?? 0);

                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateSlot(activeSlot, { size: s })}
                        className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-stone-900 bg-stone-900 text-white shadow-md scale-[1.02]'
                            : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                      >
                        <span className="text-base font-bold tracking-tight">{s}</span>
                        <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                          {circ}cm
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Fit Assessment Card */}
                {activeResolved && (
                  <div className={`rounded-xl p-3 border text-xs transition-all ${
                    ease !== null && ease >= 4 && ease <= 14
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : ease !== null && ease >= 0 && ease < 4
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : ease !== null && ease > 14
                          ? 'bg-sky-50 border-sky-200 text-sky-950'
                          : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        {ease !== null && ease >= 4 && ease <= 14 && '✓ Vừa vặn hoàn hảo'}
                        {ease !== null && ease >= 0 && ease < 4 && 'ℹ Dáng ôm sát (Slim Fit)'}
                        {ease !== null && ease > 14 && 'ℹ Rộng rãi / Oversize'}
                        {ease !== null && ease < 0 && '⚠ Quá chật (Áo nhỏ hơn người)'}
                      </span>
                      <span className="font-mono text-[11px] font-bold">
                        {ease !== null && ease >= 0 ? `+${ease.toFixed(1)}` : ease?.toFixed(1)} cm
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-stone-600 leading-snug">
                      {ease !== null && ease >= 4 && ease <= 14 && 'Kích thước này vừa in với cơ thể của bạn, cử động tự nhiên không bị gò bó.'}
                      {ease !== null && ease >= 0 && ease < 4 && 'Áo ôm nhẹ theo số đo cơ thể. Nếu bạn muốn mặc rộng rãi thoải mái hơn, hãy cân nhắc chọn tăng 1 size.'}
                      {ease !== null && ease > 14 && 'Dáng suông rộng thoáng mát, tạo phong cách trẻ trung năng động.'}
                      {ease !== null && ease < 0 && 'Kích thước này nhỏ hơn số đo cơ thể, sẽ bị bó chật. Bạn nên tăng size.'}
                    </p>

                    <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500">
                      <span>Vòng {fitKey === 'waistCircCm' ? 'eo' : 'ngực'} người: <b>{bodyCircCm.toFixed(1)}cm</b></span>
                      <span>Vòng {fitKey === 'waistCircCm' ? 'quần' : 'áo'}: <b>{Math.round(garmentCircCm ?? 0)}cm</b></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. MÀU SẮC TRANG PHỤC */}
            {active.kind && TEXTURES[active.kind] && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block mb-2">
                  Màu sắc trang phục
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEXTURES[active.kind].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        updateSlot(activeSlot, {
                          textureKey: t.key,
                          pattern: t.pattern,
                          baseColor: t.color,
                          color2: t.color2,
                          fabricKey: t.fabric,
                          front: null,
                          back: null,
                          presetIdx: -1,
                          presetAuto: false,
                        })
                      }
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs transition-all ${
                        active.textureKey === t.key
                          ? 'border-stone-900 bg-stone-900 text-white shadow-xs font-medium'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-inner"
                        style={{ background: t.color }}
                      />
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. VÓC DÁNG CƠ BẢN (Nam/Nữ & Chiều cao/Cân nặng) */}
            <div className="rounded-2xl border border-stone-200 p-3.5 space-y-3 bg-stone-50/40">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                  Vóc dáng của bạn
                </label>
                <span className="text-[11px] font-medium text-stone-500">
                  {profile.gender === 'female' ? 'Nữ' : 'Nam'} · {profile.height}cm · {profile.weight}kg
                </span>
              </div>

              {/* Gender selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-200/50 rounded-xl">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setCustomMode(true);
                      setCustom((c) => ({ ...c, gender: g }));
                    }}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      (customMode ? custom.gender : profile.gender) === g
                        ? 'bg-white text-stone-900 shadow-xs font-semibold'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {g === 'male' ? 'Nam' : 'Nữ'}
                  </button>
                ))}
              </div>

              {/* Simple Sliders: Chiều cao & Cân nặng */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs text-stone-700 mb-1">
                    <span>Chiều cao</span>
                    <span className="font-semibold text-stone-900">{customMode ? custom.height : profile.height} cm</span>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={195}
                    step={1}
                    value={customMode ? custom.height : profile.height}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setCustomMode(true);
                      setCustom((c) => {
                        const [wLo, wHi] = weightBounds(v);
                        return { ...c, height: v, weight: clampNum(c.weight, wLo, wHi) };
                      });
                    }}
                    className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-stone-700 mb-1">
                    <span>Cân nặng</span>
                    <span className="font-semibold text-stone-900">{customMode ? custom.weight : profile.weight} kg</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    step={1}
                    value={customMode ? custom.weight : profile.weight}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setCustomMode(true);
                      setCustom((c) => ({ ...c, weight: v }));
                    }}
                    className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setProfileKey(profile.gender === 'female' ? 'F2' : 'B');
                  }}
                  className={`flex-1 py-1 px-2 rounded-lg border text-[11px] text-center transition-all ${
                    !customMode && (profileKey === 'B' || profileKey === 'F2')
                      ? 'border-stone-900 bg-stone-900 text-white font-medium shadow-xs'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                  }`}
                >
                  Mẫu chuẩn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setProfileKey(profile.gender === 'female' ? 'F1' : 'A');
                  }}
                  className={`flex-1 py-1 px-2 rounded-lg border text-[11px] text-center transition-all ${
                    !customMode && (profileKey === 'A' || profileKey === 'F1')
                      ? 'border-stone-900 bg-stone-900 text-white font-medium shadow-xs'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                  }`}
                >
                  Thon gọn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setProfileKey(profile.gender === 'female' ? 'F3' : 'C');
                  }}
                  className={`flex-1 py-1 px-2 rounded-lg border text-[11px] text-center transition-all ${
                    !customMode && (profileKey === 'C' || profileKey === 'F3')
                      ? 'border-stone-900 bg-stone-900 text-white font-medium shadow-xs'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                  }`}
                >
                  Đầy đặn
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Footer: Add to Cart CTA */}
          <div className="p-4 border-t border-stone-200 bg-white space-y-2.5">
            {wornItems.length > 0 && (
              <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-100">
                <span className="text-stone-500 font-medium">
                  {wornItems.length === 2 ? 'Combo đang mặc (Áo + Quần):' : 'Sản phẩm đang thử:'}
                </span>
                <span className="text-stone-900 font-bold tabular-nums">
                  {comboTotal > 0 ? `${comboTotal.toLocaleString('vi-VN')}₫` : '398.000₫'}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onAddToCart && wornItems.length > 0) {
                    onAddToCart({ items: wornItems, buyNow: false });
                  } else {
                    alert(`Đã chọn kích thước Size ${active.size} cho trang phục của bạn!`);
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🛍️ {wornItems.length === 2 ? 'Thêm cả bộ vào giỏ' : `Thêm Size ${active.size} vào giỏ`}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onAddToCart && wornItems.length > 0) {
                    onAddToCart({ items: wornItems, buyNow: true });
                  } else {
                    alert(`Đang chuyển đến trang thanh toán...`);
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1"
                title="Mua ngay combo vừa vặn này"
              >
                <span>⚡ Mua ngay</span>
              </button>
            </div>

            <p className="text-[10px] text-stone-500 text-center flex items-center justify-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Tự động gán huy hiệu <strong>"Đã thử 3D · Vừa vặn"</strong> vào giỏ</span>
            </p>
          </div>
        </aside>

        <main className="relative min-w-0 flex-1 h-[680px] lg:h-full overflow-hidden bg-gradient-to-b from-[#faf8f5] to-[#eae6df]">
          {/* Top-Left: Studio Runway HUD */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/90 px-3.5 py-1.5 text-stone-800 shadow-sm backdrop-blur-md">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold tracking-wide uppercase text-[11px] text-stone-900">Studio Runway 3D</span>
              <span className="text-stone-300">|</span>
              <span className="text-stone-600 font-medium">{profile.gender === 'female' ? 'Mẫu nữ' : 'Mẫu nam'} {profile.height}cm · {profile.weight}kg</span>
              {active && (
                <>
                  <span className="text-stone-300">|</span>
                  <span className="text-stone-700 font-semibold">Size: {active.size}</span>
                </>
              )}
            </div>
          </div>

          {/* Top-Right: Quick Studio Actions */}
          <div className="absolute right-4 top-4 z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSpinning((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all backdrop-blur-md ${
                spinning
                  ? 'bg-stone-900 text-white ring-2 ring-stone-900/30 shadow-md'
                  : 'bg-white/90 text-stone-700 hover:bg-white border border-stone-300/80 hover:border-stone-400'
              }`}
            >
              <span>{spinning ? '⏸ Dừng xoay' : '⟳ Xoay 360°'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowStretch((v) => !v);
                setShowFaces(false);
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all backdrop-blur-md ${
                showStretch
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400/50 shadow-md'
                  : 'bg-white/90 text-stone-700 hover:bg-white border border-stone-300/80 hover:border-stone-400'
              }`}
            >
              <span>{showStretch ? '✓ Đang soi độ căng' : '🔍 Soi độ vừa vặn'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTurnNonce((n) => n + 1)}
              className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-white border border-stone-300/80 shadow-sm backdrop-blur-md"
              title="Xoay người mẫu 180 độ để ngắm mặt sau"
            >
              ↺ 180°
            </button>
          </div>

          {/* Bottom-Left: Fit & Tension Heatmap Legend (When showStretch is active) */}
          {showStretch && (
            <div className="absolute bottom-4 left-4 z-10 rounded-2xl border border-stone-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md text-xs animate-in fade-in duration-300">
              <p className="font-semibold text-stone-800 mb-2 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>Bản đồ độ vừa vặn & căng vải ({SLOT_LABEL[activeSlot]})</span>
              </p>
              <div className="flex items-center gap-4 text-[11px] text-stone-600">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#38bdf8] shadow-xs" />
                  Rộng / Thoải mái
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#10b981] shadow-xs" />
                  Chuẩn phom vừa in
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#ef4444] shadow-xs" />
                  Căng bó theo số đo
                </span>
              </div>
            </div>
          )}

          {/* Bottom-Right: Quick Camera Framing Views */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-full border border-stone-200/90 bg-white/90 p-1 shadow-md backdrop-blur-md">
            {(
              [
                ['full', 'Toàn thân'],
                ['neck', 'Thân trên'],
                ['legs', 'Thân dưới'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  view === v
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <GarmentClothCanvas
            avatar={scene.avatar}
            colliders={scene.colliders}
            groundY={scene.groundY}
            spinning={spinning}
            spinSpeed={spinSpeed}
            turnNonce={turnNonce}
            wireframe={wireframe}
            view={view}
            pieces={pieces}
          />
        </main>
      </div>
    </div>
  );
}
