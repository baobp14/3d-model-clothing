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
import {
  removeGarmentBackground,
  trimToContent,
  blobToTexture,
  averageOpaqueColor,
} from '@/lib/tryon/backgroundRemoval';
import {
  buildBodyCollider,
  buildConstraints,
  verdictForEase,
  FABRICS,
  type BodyCollider,
  type GarmentConstraints,
  type GarmentGeometry,
} from '@/lib/tryon/garmentFit';

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
}

const DEFAULT_CALIB = { scale: 1, offsetX: 0, offsetY: 0 };
type GarmentKind = 'tshirt' | 'pants';

type SizedGeom = Record<string, { geom: GarmentGeometry; constraints: GarmentConstraints }>;

type Loaded = {
  rigs: Record<string, MorphRig>;
  avatars: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  garments: Record<GarmentKind, SizedGeom>;
  meta: GarmentMeta;
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

export default function GarmentTestApp() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileKey, setProfileKey] = useState<string>('B');
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
  const [size, setSize] = useState('M');
  const [fabricKey, setFabricKey] = useState<keyof typeof FABRICS>('knit');
  const [spinning, setSpinning] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(1.6);
  const [turnNonce, setTurnNonce] = useState(0);
  const [showStretch, setShowStretch] = useState(false);
  const [showFaces, setShowFaces] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [front, setFront] = useState<THREE.Texture | null>(null);
  const [back, setBack] = useState<THREE.Texture | null>(null);
  const [baseColor, setBaseColor] = useState('#41599c');
  const [printScale, setPrintScale] = useState(1);
  const [printOffsetY, setPrintOffsetY] = useState(0);
  const [garmentKind, setGarmentKind] = useState<GarmentKind>('tshirt');
  const gEntry = loaded?.meta.garments?.[garmentKind];
  // Slider values the mesh ships with; sliders start here, "Bỏ ảnh in" returns here.
  const calib = gEntry?.printCalibration ?? loaded?.meta.printCalibration ?? DEFAULT_CALIB;
  const [printBusy, setPrintBusy] = useState<string | null>(null);

  // Built-in shirt prints, pre-cut and pre-trimmed at build time
  // (npm run prints:build -> public/prints/). Switching is just a texture
  // swap -- none of the WASM background-removal that an upload needs.
  type PrintEntry = {
    id: string;
    name: string;
    front: string;
    back: string | null;
    baseColor: string;
  };
  const [presets, setPresets] = useState<PrintEntry[]>([]);
  const [presetIdx, setPresetIdx] = useState(-1);
  const [presetAuto, setPresetAuto] = useState(false);
  const texCache = useRef(new Map<string, THREE.Texture>());

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

  async function loadPreset(idx: number) {
    const entry = presets[idx];
    if (!entry) return;
    setPresetIdx(idx);
    setPrintBusy('preset');
    try {
      const [f, b] = await Promise.all([
        presetTexture(entry.front),
        entry.back ? presetTexture(entry.back) : Promise.resolve(null),
      ]);
      setFront(f);
      setBack(b);
      setBaseColor(entry.baseColor);
    } catch (err) {
      console.error('[garment-test] preset', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPrintBusy(null);
    }
  }

  const stepPreset = (delta: number) => {
    if (!presets.length) return;
    const base = presetIdx < 0 ? (delta > 0 ? -1 : 0) : presetIdx;
    void loadPreset((base + delta + presets.length) % presets.length);
  };

  // Auto-advance: wait for the current one to finish draping, then move on.
  useEffect(() => {
    if (!presetAuto || !presets.length || printBusy) return;
    const t = setTimeout(() => stepPreset(1), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetAuto, presetIdx, printBusy, presets.length]);

  async function loadPrint(side: 'front' | 'back', file: File | undefined) {
    if (!file) return;
    setPrintBusy(side);
    try {
      const blob = await removeGarmentBackground(file);
      const trimmed = await trimToContent(blob);
      // Trim the transparent margin so the garment fills the shirt's UV
      // instead of shrinking to a patch in the middle of it.
      const tex = await blobToTexture(trimmed);
      tex.colorSpace = THREE.SRGBColorSpace;
      (side === 'front' ? setFront : setBack)(tex);
      // Tint the bare fabric (sleeves, collar) to the shirt's own colour so
      // it does not read as a contrast panel where the photo runs out.
      if (side === 'front') setBaseColor(await averageOpaqueColor(trimmed));
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
              position: g.attributes.position.array as Float32Array,
              morphDeltas: morphs.map((a) => a.array as Float32Array),
            },
            metadata,
            gender,
          );
          avatars[gender] = gltf.scene;
          meshes[gender] = body as THREE.Mesh;
        }

        const gMetaRes = await fetch('/models/garment-metadata.json');
        if (!gMetaRes.ok) throw new Error('garment-metadata.json missing — run npm run garment:build');
        const meta: GarmentMeta = await gMetaRes.json();

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
            };
            const sizeKey = m.name.replace(prefix, '');
            out[sizeKey] = { geom, constraints: buildConstraints(geom, []) };
          });
          return out;
        };

        const garments = {
          tshirt: await loadGarment('/models/garment-tshirt.glb', 'tshirt_'),
          pants: await loadGarment('/models/garment-pants.glb', 'pants_'),
        };

        if (cancelled) return;
        setLoaded({ rigs, avatars, meshes, garments, meta });
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

  // Snap the print sliders to the mesh's baked calibration when it loads, so a
  // user who uploads a photo gets the right fit without touching anything.
  useEffect(() => {
    if (!loaded) return;
    const c = loaded.meta.printCalibration ?? DEFAULT_CALIB;
    setPrintScale(c.scale);
    setPrintOffsetY(c.offsetY);
  }, [loaded]);

  // Solve the body, push the morphs onto the visible mesh, and rebuild the
  // colliders. Cheap enough to redo whenever the profile changes.
  const scene = useMemo(() => {
    if (!loaded) return null;
    const rig = loaded.rigs[profile.gender];
    const solved = solveAxes(rig, profile);
    const influences = axesToInfluences(rig, solved.axes);

    const mesh = loaded.meshes[profile.gender];
    if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== influences.length) {
      mesh.morphTargetInfluences = Array.from(influences);
    } else {
      for (let i = 0; i < influences.length; i++) mesh.morphTargetInfluences[i] = influences[i];
    }

    const index = mesh.geometry.index;
    if (!index) throw new Error('Body mesh has no index buffer');
    const collider: BodyCollider = buildBodyCollider(rig, influences, index.array);
    collider.yaw = 0;

    // Lowest point of the morphed body = where the floor must sit, otherwise a
    // shorter body hangs above the disc or a taller one sinks through it.
    const base = mesh.geometry.attributes.position.array as Float32Array;
    const deltas = (mesh.geometry.morphAttributes.position ?? []).map(
      (a) => a.array as Float32Array,
    );
    let groundY = Infinity;
    for (let i = 1; i < base.length; i += 3) {
      let y = base[i];
      for (let m = 0; m < deltas.length; m++) y += influences[m] * deltas[m][i];
      if (y < groundY) groundY = y;
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
  }, [loaded, profile]);

  const garment = loaded?.garments[garmentKind]?.[size] ?? null;
  const fitKey = gEntry?.fitKey ?? 'chestCircCm';
  const garmentCircCm =
    (loaded && gEntry?.sizes[size]?.[fitKey]) ??
    (loaded ? loaded.meta.sizes[size]?.chestCircCm : 0);
  const bodyCircCm = scene
    ? fitKey === 'waistCircCm'
      ? scene.body.waist
      : scene.body.chest
    : 0;
  const ease = loaded && scene ? garmentCircCm - bodyCircCm : null;

  if (error) {
    return <div className="p-6 text-sm text-red-600">Lỗi: {error}</div>;
  }
  if (!loaded || !scene || !garment) {
    return <div className="p-6 text-sm text-stone-500">Đang tải avatar và mesh áo…</div>;
  }

  const verdict = ease === null ? '' : verdictForEase(ease);
  const verdictLabel: Record<string, string> = {
    chat: 'Chật',
    vua: 'Vừa',
    rong: 'Rộng',
  };

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 px-5 py-3">
        <h1 className="text-base font-semibold text-stone-900">
          Mặc thử bằng mesh áo thật — mô phỏng vải
        </h1>
        <p className="text-xs text-stone-500">
          Áo là mesh có kích thước theo bảng size, không phải ảnh dán. Xoay người để thấy tà áo
          văng theo quán tính.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-r border-stone-200 bg-white p-4">
          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Người mẫu
            </h2>
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
                  {key} · {p.chest}cm
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
              Món đồ
            </h2>
            <div className="mb-2 flex gap-1.5">
              {(['tshirt', 'pants'] as const).map((k) => (
                <Button
                  key={k}
                  active={garmentKind === k}
                  onClick={() => setGarmentKind(k)}
                >
                  {k === 'tshirt' ? 'Áo thun' : 'Quần'}
                </Button>
              ))}
            </div>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Size {garmentKind === 'pants' ? 'quần' : 'áo'}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {loaded.meta.sizeOrder.map((s) => (
                <Button key={s} active={size === s} onClick={() => setSize(s)}>
                  {s} · {Math.round((gEntry?.sizes[s]?.[fitKey] ?? loaded.meta.sizes[s]?.chestCircCm) || 0)}cm
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Chất vải
            </h2>
            <div className="flex flex-col gap-1.5">
              {FABRIC_LIST.map(([key, label]) => (
                <Button
                  key={key}
                  active={fabricKey === key}
                  onClick={() => setFabricKey(key as keyof typeof FABRICS)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Chuyển động
            </h2>
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
              Ảnh in lên áo
            </h2>
            <div className="space-y-1.5">
              {(['front', 'back'] as const).map((side) => (
                <label key={side} className="block text-xs text-stone-600">
                  <span className="mb-0.5 block">
                    {side === 'front' ? 'Mặt trước' : 'Mặt sau'}
                    {printBusy === side && ' — đang tách nền…'}
                    {(side === 'front' ? front : back) && ' ✓'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => loadPrint(side, e.target.files?.[0])}
                    className="w-full text-[11px] file:mr-2 file:rounded file:border file:border-stone-300 file:bg-white file:px-2 file:py-0.5 file:text-[11px]"
                  />
                </label>
              ))}
              {presets.length > 0 && (
                <div className="rounded border border-stone-200 bg-stone-50 p-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepPreset(-1)}
                      disabled={printBusy === 'preset'}
                      className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-40"
                    >
                      ◀
                    </button>
                    <span className="flex-1 truncate text-center text-[11px] text-stone-600">
                      {printBusy === 'preset'
                        ? 'đang tải…'
                        : presetIdx < 0
                          ? `Bộ sưu tập (${presets.length})`
                          : `${presets[presetIdx].name} · ${presetIdx + 1}/${presets.length}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepPreset(1)}
                      disabled={printBusy === 'preset'}
                      className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-40"
                    >
                      ▶
                    </button>
                  </div>
                  <Button
                    active={presetAuto}
                    onClick={() => {
                      const next = !presetAuto;
                      setPresetAuto(next);
                      if (next && presetIdx < 0) stepPreset(1);
                    }}
                  >
                    {presetAuto ? '⏸ dừng tự chạy' : '▶ tự chạy hết bộ'}
                  </Button>
                </div>
              )}
              <Button
                active={false}
                onClick={() => {
                  const s = makeSamplePrints();
                  setFront(s.front);
                  setBack(s.back);
                }}
              >
                Dùng ảnh mẫu
              </Button>
              {(front || back) && (
                <Button
                  active={false}
                  onClick={() => {
                    setFront(null);
                    setBack(null);
                    setBaseColor('#41599c');
                    setPrintScale(calib.scale);
                    setPrintOffsetY(calib.offsetY);
                    setPresetAuto(false);
                    setPresetIdx(-1);
                  }}
                >
                  Bỏ ảnh in
                </Button>
              )}
            </div>

            {(front || back) && (
              <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
                <p className="text-[10px] leading-snug text-stone-400">
                  Đã căn sẵn cho mẫu áo này ({calib.scale}× · {calib.offsetY}). Chỉ chỉnh nếu
                  ảnh của bạn khác bố cục.
                </p>
                <label className="block text-xs text-stone-600">
                  Phóng ảnh in: {printScale.toFixed(2)}×
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.01}
                    value={printScale}
                    onChange={(e) => setPrintScale(parseFloat(e.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="text-[10px] text-stone-400">nhỏ = hoa văn to · lớn = hoa văn nhỏ</span>
                </label>
                <label className="block text-xs text-stone-600">
                  Dời lên / xuống: {printOffsetY > 0 ? '+' : ''}
                  {printOffsetY.toFixed(2)}
                  <input
                    type="range"
                    min={-0.3}
                    max={0.3}
                    step={0.01}
                    value={printOffsetY}
                    onChange={(e) => setPrintOffsetY(parseFloat(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                {(printScale !== calib.scale || printOffsetY !== calib.offsetY) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrintScale(calib.scale);
                      setPrintOffsetY(calib.offsetY);
                    }}
                    className="text-[11px] text-stone-500 underline underline-offset-2"
                  >
                    ↺ về mẫu chuẩn
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Hiển thị
            </h2>
            <div className="flex flex-col gap-1.5">
              <Button
                active={showFaces}
                onClick={() => {
                  setShowFaces((v) => !v);
                  setShowStretch(false);
                }}
              >
                Vùng trước / sau
              </Button>
              <Button
                active={showStretch}
                onClick={() => {
                  setShowStretch((v) => !v);
                  setShowFaces(false);
                }}
              >
                Bản đồ độ căng
              </Button>
              <Button active={wireframe} onClick={() => setWireframe((v) => !v)}>
                Khung lưới
              </Button>
            </div>
            {showFaces && (
              <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
                <span className="text-cyan-600">■</span> vùng ăn ảnh MẶT TRƯỚC ·{' '}
                <span className="text-orange-500">■</span> vùng ăn ảnh MẶT SAU ·{' '}
                <span className="text-stone-400">■</span> tay / cổ / vai — không in
              </p>
            )}
          </section>

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
              <span className="font-medium">{Math.round(garmentCircCm)} cm</span>
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
        </aside>

        <main className="min-w-0 flex-1">
          <GarmentClothCanvas
            avatar={scene.avatar}
            geom={garment.geom}
            constraints={garment.constraints}
            colliders={scene.colliders}
            groundY={scene.groundY}
            pinRegion={gEntry?.pinRegion ?? 5}
            anchorY={
              (gEntry?.yZero ?? '').startsWith('waist')
                ? scene.colliders.waistY
                : scene.colliders.shoulderY
            }
            fabric={FABRICS[fabricKey]}
            spinning={spinning}
            spinSpeed={spinSpeed}
            turnNonce={turnNonce}
            showStretch={showStretch}
            showFaces={showFaces}
            wireframe={wireframe}
            frontPrint={front}
            backPrint={back}
            baseColor={baseColor}
            printScale={printScale}
            printOffset={[0, printOffsetY]}
          />
        </main>
      </div>
    </div>
  );
}
