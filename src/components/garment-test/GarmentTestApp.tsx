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
import { applyPose, POSES, type AvatarRig, type PoseKey } from '@/lib/avatar/pose';
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
  return {
    chest: step(chest, 'chest'),
    waist: step(fit.waist[0] + fit.waist[1] * w + fit.waist[2] * h, 'waist'),
    hip: step(fit.hip[0] + fit.hip[1] * w + fit.hip[2] * h, 'hip'),
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
  top: ['tshirt', 'tank', 'croptop', 'shirt', 'longshirt', 'sweater', 'jacket', 'dress'],
  bottom: ['pants', 'shorts', 'capri', 'skirt'],
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
  garments: Record<GarmentKind, SizedGeom>;
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

export default function GarmentTestApp() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileKey, setProfileKey] = useState<string>('B');
  const [pose, setPose] = useState<PoseKey>('apose');
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState<AvatarBodyInput>({ ...PROFILES.B });
  // Per-field: ticked = the user sets it, unticked = the app estimates it.
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

        const rigs: Record<string, MorphRig> = {};
        const avatars: Record<string, THREE.Object3D> = {};
        const meshes: Record<string, THREE.Mesh> = {};
        const poseRigs: Record<string, AvatarRig> = {};
        for (const gender of ['male', 'female'] as const) {
          const gltf = await loader.loadAsync(`/models/avatar-${gender}.glb`);
          let body: THREE.Mesh | null = null;
          gltf.scene.traverse((o) => {
            if (!body && (o as THREE.Mesh).isMesh) body = o as THREE.Mesh;
          });
          if (!body) throw new Error(`No mesh in avatar-${gender}.glb`);
          const g = (body as THREE.Mesh).geometry;
          const morphs = g.morphAttributes.position;
          if (!morphs) throw new Error(`avatar-${gender}.glb has no position morph targets`);
          rigs[gender] = createMorphRig(
            {
              // A copy: posing writes the skinned body into the mesh's own
              // position buffer, which must not become the rig's rest shape.
              position: Float32Array.from(g.attributes.position.array as Float32Array),
              morphDeltas: morphs.map((a) => a.array as Float32Array),
            },
            metadata,
            gender,
          );
          avatars[gender] = gltf.scene;
          meshes[gender] = body as THREE.Mesh;
          // Keep the unposed base so switching back to chữ A restores morphs.
          (body as THREE.Mesh).userData.basePosition = Float32Array.from(
            g.attributes.position.array as Float32Array,
          );
          const rigRes = await fetch(`/models/avatar-rig-${gender}.json`);
          if (rigRes.ok) poseRigs[gender] = await rigRes.json();
        }

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

        const garments = {
          tshirt: await loadGarment('/models/garment-tshirt.glb', 'tshirt_'),
          tank: await loadGarment('/models/garment-tank.glb', 'tank_'),
          croptop: await loadGarment('/models/garment-croptop.glb', 'croptop_'),
          shirt: await loadGarment('/models/garment-shirt.glb', 'shirt_'),
          longshirt: await loadGarment('/models/garment-longshirt.glb', 'longshirt_'),
          sweater: await loadGarment('/models/garment-sweater.glb', 'sweater_'),
          jacket: await loadGarment('/models/garment-jacket.glb', 'jacket_'),
          dress: await loadGarment('/models/garment-dress.glb', 'dress_'),
          dressskirt: await loadGarment('/models/garment-dressskirt.glb', 'dressskirt_'),
          pants: await loadGarment('/models/garment-pants.glb', 'pants_'),
          shorts: await loadGarment('/models/garment-shorts.glb', 'shorts_'),
          capri: await loadGarment('/models/garment-capri.glb', 'capri_'),
          skirt: await loadGarment('/models/garment-skirt.glb', 'skirt_'),
        };

        if (cancelled) return;
        setLoaded({ rigs, avatars, meshes, garments, meta, bodyRef, poseRigs });
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
    const solved = solveAxes(rig, profile);
    const influences = axesToInfluences(rig, solved.axes);

    const mesh = loaded.meshes[profile.gender];
    const poseRig = loaded.poseRigs[profile.gender];
    // Posed: skin on the CPU and show the result directly (morphs baked in,
    // influences zeroed). Chữ A: the untouched base + GPU morphs as before.
    const posed =
      pose !== 'apose' && poseRig
        ? applyPose(poseRig, deformPositions(rig, influences), pose)
        : undefined;
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
    const collider: BodyCollider = buildBodyCollider(rig, influences, index.array, 0.05, posed);
    collider.yaw = 0;
    collider.refPositions = loaded.bodyRef;

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
  function resolveSlot(slot: Slot) {
    // A dress fills both slots: the bottom becomes the dress's own skirt, cut
    // from the same cloth and size as its bodice.
    const st: SlotState =
      slot === 'bottom' && wearingDress ? { ...slots.top, kind: 'dressskirt' } : slots[slot];
    if (!loaded || !st.kind) return null;
    const sized = loaded.garments[st.kind]?.[st.size];
    if (!sized) return null;
    const entry = loaded.meta.garments[st.kind];
    return { state: st, entry, ...sized };
  }
  const topResolved = resolveSlot('top');
  const bottomResolved = resolveSlot('bottom');

  const activeResolved = activeSlot === 'top' ? topResolved : bottomResolved;
  const garmentCircCm = activeResolved
    ? activeResolved.entry?.sizes[activeResolved.state.size]?.[fitKey]
    : undefined;
  const bodyCircCm = scene ? (fitKey === 'waistCircCm' ? scene.body.waist : scene.body.chest) : 0;
  const ease =
    activeResolved && scene && garmentCircCm !== undefined ? garmentCircCm - bodyCircCm : null;

  if (error) {
    return <div className="p-6 text-sm text-red-600">Lỗi: {error}</div>;
  }
  if (!loaded || !scene) {
    return <div className="p-6 text-sm text-stone-500">Đang tải avatar và mesh áo…</div>;
  }

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
    for (let v = 0; v < g.regions.length; v++) {
      const r = g.regions[v];
      if (r >= GARMENT_REGION.sleeveRight && r <= GARMENT_REGION.cuffLeft) continue;
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
    // Slack: this is the hem as PLACED, and the simulated hem rides up when the
    // shirt settles -- loose tops now hang straight and lift up to ~4cm at the
    // sides, which opened a white gap between the hem and the clipped bottom.
    for (let b = 0; b < CLIP_BINS; b++) prof[b] += 0.04;
    // Where the top stops above the waistband (croptop, a hem riding up at the
    // sides) there is nothing over the bottom to hide it under -- cutting it
    // there bared a band of skin between the two. Leave those angles alone.
    const waistTop = scene.colliders.waistY - 0.02;
    for (let b = 0; b < CLIP_BINS; b++) if (prof[b] > waistTop) prof[b] = 1e3;
    return prof;
  })();

  const pieces: GarmentPieceInput[] = [];
  for (const [slot, resolved] of [['top', topResolved], ['bottom', bottomResolved]] as const) {
    if (!resolved) continue;
    pieces.push({
      key: slot,
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
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 px-5 py-3">
        <h1 className="text-base font-semibold text-stone-900">
          Mặc thử bằng mesh áo thật — mô phỏng vải
        </h1>
        <p className="text-xs text-stone-500">
          Áo là mesh có kích thước theo bảng size, không phải ảnh dán. Xoay người để thấy tà áo
          văng theo quán tính. Áo và quần mặc cùng lúc — tab bên dưới chỉ chọn cái bạn đang chỉnh.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-r border-stone-200 bg-white p-4">
          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Người mẫu
            </h2>
            <p className="mb-1.5 text-[11px] text-stone-400">
              Số đo {fitKey === 'waistCircCm' ? 'vòng eo' : 'vòng ngực'} của người mẫu — không
              phải size {fitKey === 'waistCircCm' ? 'quần' : 'áo'} đang chỉnh.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PROFILE_LIST.map(([key, p]) => (
                <Button
                  key={key}
                  active={!customMode && profileKey === key}
                  onClick={() => {
                    setCustomMode(false);
                    setProfileKey(key);
                  }}
                  title={p.label}
                >
                  {key} · {fitKey === 'waistCircCm' ? p.waist : p.chest}cm
                </Button>
              ))}
              <Button active={customMode} onClick={() => setCustomMode(true)}>
                Số đo tùy chỉnh
              </Button>
            </div>

            {customMode && (
              <div className="mt-2 space-y-2.5 border-t border-stone-200 pt-2">
                <div className="flex gap-1.5">
                  {(['male', 'female'] as const).map((g) => (
                    <Button
                      key={g}
                      active={custom.gender === g}
                      onClick={() => setCustom((c) => ({ ...c, gender: g }))}
                    >
                      {g === 'male' ? 'Nam' : 'Nữ'}
                    </Button>
                  ))}
                </div>

                {BASIC_FIELDS.map((f) => {
                  const meta = MEASURE_FIELDS[f];
                  const [wLo, wHi] = weightBounds(custom.height);
                  const lo = f === 'weight' ? wLo : meta.min;
                  const hi = f === 'weight' ? wHi : meta.max;
                  return (
                    <label key={f} className="block text-[11px] text-stone-600">
                      <span className="flex justify-between">
                        <span>{meta.label}</span>
                        <span className="tabular-nums text-stone-800">
                          {custom[f]}
                          {f === 'weight' ? ' kg' : ' cm'}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={lo}
                        max={hi}
                        step={f === 'weight' ? 1 : 0.5}
                        value={custom[f]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setCustom((c) => {
                            if (f === 'height') {
                              // Keep weight inside the BMI band for the new height.
                              const [nLo, nHi] = weightBounds(v);
                              return { ...c, height: v, weight: clampNum(c.weight, nLo, nHi) };
                            }
                            return { ...c, [f]: v };
                          });
                        }}
                        className="mt-0.5 w-full"
                      />
                    </label>
                  );
                })}

                <p className="pt-0.5 text-[10px] uppercase tracking-wide text-stone-400">
                  App tự tính từ chiều cao + cân nặng — tick để tự chỉnh
                </p>

                {DERIVED_FIELDS.map((f) => {
                  const meta = MEASURE_FIELDS[f];
                  const on = manual[f];
                  return (
                    <div key={f} className="text-[11px] text-stone-600">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => {
                              const next = e.target.checked;
                              // Turning on: seed the slider from the current estimate.
                              if (next)
                                setCustom((c) => ({ ...c, [f]: deriveSecondary(c)[f] }));
                              setManual((m) => ({ ...m, [f]: next }));
                            }}
                          />
                          {meta.label}
                          {!on && <span className="text-stone-400">(tự tính)</span>}
                        </label>
                        <span className="tabular-nums text-stone-800">
                          {customResolved[f]} cm
                        </span>
                      </div>
                      {on && (
                        <input
                          type="range"
                          min={meta.min}
                          max={meta.max}
                          step={0.5}
                          value={custom[f]}
                          onChange={(e) =>
                            setCustom((c) => ({ ...c, [f]: parseFloat(e.target.value) }))
                          }
                          className="mt-0.5 w-full"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCustom({ ...PROFILES.B });
                      clearManual();
                    }}
                    className="text-stone-500 underline underline-offset-2"
                  >
                    ↺ về mặc định
                  </button>
                  {scene && (
                    <span className="text-stone-400">
                      sai số solver {scene.solveError.toFixed(2)} cm
                    </span>
                  )}
                </div>
                {scene && scene.outOfRange.length > 0 && (
                  <p className="text-[11px] leading-snug text-amber-600">
                    ⚠ Ngoài tầm morph: {scene.outOfRange.join(', ')} — cơ thể đã kịch cỡ, số đo
                    thực tế sẽ lệch.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Trang phục
            </h2>
            <div className="mb-2 flex gap-1.5">
              {(['top', 'bottom'] as const).map((s) => (
                <Button key={s} active={activeSlot === s} onClick={() => setActiveSlot(s)}>
                  {SLOT_LABEL[s]}
                  {slots[s].kind ? ` · ${GARMENT_LABEL[slots[s].kind!]}` : ' · (trống)'}
                </Button>
              ))}
            </div>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Món đồ ({SLOT_LABEL[activeSlot]})
            </h2>
            {activeSlot === 'bottom' && wearingDress && (
              <p className="mb-1.5 text-[11px] text-amber-700">
                Đang mặc đầm — phần váy đi theo đầm. Đổi áo ở tab Áo để mặc quần/váy riêng.
              </p>
            )}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SLOT_KINDS[activeSlot].map((k) => (
                <Button
                  key={k}
                  active={active.kind === k}
                  onClick={() => {
                    const nextKind = active.kind === k ? null : k;
                    const nextCalib = nextKind
                      ? (loaded.meta.garments[nextKind]?.printCalibration ?? DEFAULT_CALIB)
                      : DEFAULT_CALIB;
                    // presetIdx is a position in that kind's preset list,
                    // which is about to change -- the old index would point
                    // at an unrelated entry, or past the end.
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
                >
                  {GARMENT_LABEL[k]}
                </Button>
              ))}
            </div>
            {active.kind && (
              <>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Size {fitKey === 'waistCircCm' ? 'quần' : 'áo'}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {loaded.meta.sizeOrder.map((s) => (
                    <Button
                      key={s}
                      active={active.size === s}
                      onClick={() => updateSlot(activeSlot, { size: s })}
                    >
                      {s} · {Math.round(activeEntry?.sizes[s]?.[fitKey] ?? 0)}cm
                    </Button>
                  ))}
                </div>
              </>
            )}
          </section>

          {active.kind && (
            <>
              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Chất liệu ({GARMENT_LABEL[active.kind]})
                </h2>
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
                      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[11px] ${
                        active.textureKey === t.key
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-sm border border-black/10"
                        style={{
                          background:
                            t.pattern === 'plain' || t.color2 === '#ffffff'
                              ? t.color
                              : `repeating-linear-gradient(90deg, ${t.color} 0 4px, ${t.color2} 4px 6px)`,
                        }}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-600">
                  <label className="flex items-center gap-1">
                    Màu chính
                    <input
                      id={`color1-${activeSlot}`}
                      type="color"
                      value={active.baseColor}
                      onChange={(e) => updateSlot(activeSlot, { baseColor: e.target.value })}
                      className="h-6 w-8 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Màu phụ
                    <input
                      id={`color2-${activeSlot}`}
                      type="color"
                      value={active.color2}
                      onChange={(e) => updateSlot(activeSlot, { color2: e.target.value })}
                      className="h-6 w-8 cursor-pointer"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Độ cứng vải khi mô phỏng
                </h2>
                <div className="flex flex-col gap-1.5">
                  {FABRIC_LIST.map(([key, label]) => (
                    <Button
                      key={key}
                      active={active.fabricKey === key}
                      onClick={() => updateSlot(activeSlot, { fabricKey: key as keyof typeof FABRICS })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Ảnh in lên {fitKey === 'waistCircCm' ? 'quần' : 'áo'} ({SLOT_LABEL[activeSlot]})
                </h2>
                <div className="space-y-1.5">
                  {(['front', 'back'] as const).map((side) => (
                    <label key={side} className="block text-xs text-stone-600">
                      <span className="mb-0.5 block">
                        {side === 'front' ? 'Mặt trước' : 'Mặt sau'}
                        {printBusy?.slot === activeSlot && printBusy.what === side && ' — đang tách nền…'}
                        {(side === 'front' ? active.front : active.back) && ' ✓'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => loadPrint(activeSlot, side, e.target.files?.[0])}
                        className="w-full text-[11px] file:mr-2 file:rounded file:border file:border-stone-300 file:bg-white file:px-2 file:py-0.5 file:text-[11px]"
                      />
                    </label>
                  ))}
                  {kindPresets.length > 0 && (
                    <div className="rounded border border-stone-200 bg-stone-50 p-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => stepPreset(-1)}
                          disabled={printBusy?.slot === activeSlot && printBusy.what === 'preset'}
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-40"
                        >
                          ◀
                        </button>
                        <span className="flex-1 truncate text-center text-[11px] text-stone-600">
                          {printBusy?.slot === activeSlot && printBusy.what === 'preset'
                            ? 'đang tải…'
                            : active.presetIdx < 0
                              ? `Bộ sưu tập (${kindPresets.length})`
                              : `${kindPresets[active.presetIdx].name} · ${active.presetIdx + 1}/${kindPresets.length}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => stepPreset(1)}
                          disabled={printBusy?.slot === activeSlot && printBusy.what === 'preset'}
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-40"
                        >
                          ▶
                        </button>
                      </div>
                      <Button
                        active={active.presetAuto}
                        onClick={() => {
                          const next = !active.presetAuto;
                          updateSlot(activeSlot, { presetAuto: next });
                          if (next && active.presetIdx < 0) stepPreset(1);
                        }}
                      >
                        {active.presetAuto ? '⏸ dừng tự chạy' : '▶ tự chạy hết bộ'}
                      </Button>
                    </div>
                  )}
                  <Button
                    active={false}
                    onClick={() => {
                      const s = makeSamplePrints();
                      updateSlot(activeSlot, { front: s.front, back: s.back });
                    }}
                  >
                    Dùng ảnh mẫu
                  </Button>
                  {(active.front || active.back) && (
                    <Button
                      active={false}
                      onClick={() => {
                        updateSlot(activeSlot, {
                          front: null,
                          back: null,
                          baseColor: '#41599c',
                          printScale: calib.scale,
                          printOffsetY: calib.offsetY,
                          presetAuto: false,
                          presetIdx: -1,
                        });
                      }}
                    >
                      Bỏ ảnh in
                    </Button>
                  )}
                </div>

                {(active.front || active.back) && (
                  <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
                    <p className="text-[10px] leading-snug text-stone-400">
                      Đã căn sẵn cho mẫu áo này ({calib.scale}× · {calib.offsetY}). Chỉ chỉnh nếu
                      ảnh của bạn khác bố cục.
                    </p>
                    <label className="block text-xs text-stone-600">
                      Phóng ảnh in: {active.printScale.toFixed(2)}×
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.01}
                        value={active.printScale}
                        onChange={(e) => updateSlot(activeSlot, { printScale: parseFloat(e.target.value) })}
                        className="mt-1 w-full"
                      />
                      <span className="text-[10px] text-stone-400">nhỏ = hoa văn to · lớn = hoa văn nhỏ</span>
                    </label>
                    <label className="block text-xs text-stone-600">
                      Dời lên / xuống: {active.printOffsetY > 0 ? '+' : ''}
                      {active.printOffsetY.toFixed(2)}
                      <input
                        type="range"
                        min={-0.3}
                        max={0.3}
                        step={0.01}
                        value={active.printOffsetY}
                        onChange={(e) => updateSlot(activeSlot, { printOffsetY: parseFloat(e.target.value) })}
                        className="mt-1 w-full"
                      />
                    </label>
                    {(active.printScale !== calib.scale || active.printOffsetY !== calib.offsetY) && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSlot(activeSlot, { printScale: calib.scale, printOffsetY: calib.offsetY })
                        }
                        className="text-[11px] text-stone-500 underline underline-offset-2"
                      >
                        ↺ về mẫu chuẩn
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Chuyển động
            </h2>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(Object.keys(POSES) as PoseKey[]).map((k) => (
                <Button key={k} active={pose === k} onClick={() => setPose(k)}>
                  {POSES[k].label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button active={spinning} onClick={() => setSpinning((v) => !v)}>
                {spinning ? 'Đang quay — dừng' : 'Quay người liên tục'}
              </Button>
              <Button active={false} onClick={() => setTurnNonce((n) => n + 1)}>
                Quay ngoặt 180°
              </Button>
              <label className="mt-1 block text-xs text-stone-600">
                Tốc độ quay: {spinSpeed.toFixed(1)} rad/s
                <input
                  type="range"
                  min={0.3}
                  max={6}
                  step={0.1}
                  value={spinSpeed}
                  onChange={(e) => setSpinSpeed(parseFloat(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Hiển thị
            </h2>
            <div className="flex flex-col gap-1.5">
              <Button active={showTop} onClick={() => setShowTop((v) => !v)}>
                Hiện áo
              </Button>
              <Button active={showBottom} onClick={() => setShowBottom((v) => !v)}>
                Hiện quần / váy
              </Button>
              <Button
                active={showFaces}
                onClick={() => {
                  setShowFaces((v) => !v);
                  setShowStretch(false);
                }}
              >
                Vùng trước / sau ({SLOT_LABEL[activeSlot]})
              </Button>
              <Button
                active={showStretch}
                onClick={() => {
                  setShowStretch((v) => !v);
                  setShowFaces(false);
                }}
              >
                Bản đồ độ căng ({SLOT_LABEL[activeSlot]})
              </Button>
              <Button active={wireframe} onClick={() => setWireframe((v) => !v)}>
                Khung lưới
              </Button>
            </div>
            <h3 className="mb-1 mt-3 text-[11px] font-medium text-stone-500">Góc nhìn</h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['full', 'Toàn thân'],
                  ['neck', 'Cổ trước'],
                  ['neckBack', 'Cổ sau'],
                  ['arm', 'Tay'],
                  ['legs', 'Chân'],
                ] as const
              ).map(([v, label]) => (
                <Button key={v} active={view === v} onClick={() => setView(v)}>
                  {label}
                </Button>
              ))}
            </div>
            {showFaces && (
              <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
                <span className="text-cyan-600">■</span> vùng ăn ảnh MẶT TRƯỚC ·{' '}
                <span className="text-orange-500">■</span> vùng ăn ảnh MẶT SAU ·{' '}
                <span className="text-stone-400">■</span> tay / cổ / vai — không in
              </p>
            )}
          </section>

          {activeResolved && (
            <section className="rounded border border-stone-200 bg-stone-50 p-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">
                  {fitKey === 'waistCircCm' ? 'Eo người' : 'Ngực người'}
                </span>
                <span className="font-medium">{bodyCircCm.toFixed(1)} cm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">
                  {fitKey === 'waistCircCm' ? 'Eo quần' : 'Ngực áo'}
                </span>
                <span className="font-medium">{Math.round(garmentCircCm ?? 0)} cm</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-stone-200 pt-1">
                <span className="text-stone-500">Ease</span>
                <span
                  className={
                    'font-semibold ' +
                    (verdict === 'vua'
                      ? 'text-emerald-600'
                      : verdict === 'chat'
                        ? 'text-red-600'
                        : 'text-amber-600')
                  }
                >
                  {ease !== null && ease >= 0 ? '+' : ''}
                  {ease?.toFixed(1)} cm · {verdictLabel[verdict]}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-stone-400">
                Ease tính thẳng từ chu vi, không phụ thuộc mô phỏng.
              </p>
            </section>
          )}
        </aside>

        <main className="min-w-0 flex-1">
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
