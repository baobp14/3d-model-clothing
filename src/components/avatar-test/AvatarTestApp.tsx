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
  ZERO_AXES,
  type AvatarBodyInput,
  type AvatarMetadata,
  type AxisValues,
  type BodyMeasurementSet,
  type Gender,
  type MorphAxis,
  type MorphRig,
  type SolveResult,
} from '@/lib/avatar/avatarMorphService';
import { FEMALE_PROFILES, FIELD_LABELS, FORM_FIELDS, PROFILES } from '@/lib/avatar/bodyProfiles';
import { computeGarmentProjectors } from '@/lib/tryon/projectorSetup';
import type { GarmentProjectors } from '@/lib/tryon/projectorSetup';
import { computeTorsoMask } from '@/lib/tryon/torsoMask';
import type { CameraView } from './AvatarCanvas';
import MorphDebugPanel from './MorphDebugPanel';
import ValidationPanel from './ValidationPanel';
import GarmentUploadPanel from './tryon/GarmentUploadPanel';

// WebGL cannot be server-rendered.
const AvatarCanvas = dynamic(() => import('./AvatarCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-stone-400">
      Booting WebGL…
    </div>
  ),
});

// Kept in sync with AvatarCanvas.REFERENCE_HEIGHT_M -- change both together.
const REFERENCE_HEIGHT_M = 2.0;

type FormState = Record<(typeof FORM_FIELDS)[number], string>;

function profileToForm(profile: AvatarBodyInput): FormState {
  return {
    height: String(profile.height),
    weight: String(profile.weight),
    chest: String(profile.chest),
    waist: String(profile.waist),
    hip: String(profile.hip),
    shoulderWidth: String(profile.shoulderWidth),
    armLength: String(profile.armLength),
    inseam: String(profile.inseam),
  };
}

const EMPTY_FORM: FormState = {
  height: '',
  weight: '',
  chest: '',
  waist: '',
  hip: '',
  shoulderWidth: '',
  armLength: '',
  inseam: '',
};

export default function AvatarTestApp() {
  const [gender, setGender] = useState<Gender>('male');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [rig, setRig] = useState<MorphRig | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const [axes, setAxes] = useState<AxisValues>({ ...ZERO_AXES });
  const [solve, setSolve] = useState<SolveResult | null>(null);
  const [solving, setSolving] = useState(false);

  const [view, setView] = useState<CameraView>('reset');
  const [viewNonce, setViewNonce] = useState(0);
  const [fixedScale, setFixedScale] = useState(true);

  const [projectors, setProjectors] = useState<GarmentProjectors | null>(null);
  const [torsoMask, setTorsoMask] = useState<Float32Array | null>(null);
  const [frontTexture, setFrontTexture] = useState<THREE.Texture | null>(null);
  const [backTexture, setBackTexture] = useState<THREE.Texture | null>(null);
  const [garmentVisible, setGarmentVisible] = useState(true);

  // --- Load GLB + metadata whenever gender changes ---------------------------
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    (async () => {
      try {
        const metaRes = await fetch('/models/avatar-metadata.json');
        if (!metaRes.ok) {
          throw new Error(
            'avatar-metadata.json missing (404). Run the pipeline: python tools/avatar-pipeline/build_avatar_glb.py',
          );
        }
        const metadata: AvatarMetadata = await metaRes.json();

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(`/models/avatar-${gender}.glb`);

        let body: THREE.Mesh | null = null;
        gltf.scene.traverse((obj) => {
          if (!body && (obj as THREE.Mesh).isMesh) body = obj as THREE.Mesh;
        });
        if (!body) throw new Error('No mesh found in avatar GLB.');

        // Deliberate: this mesh density makes self-shadowing (receiveShadow)
        // produce shadow-map acne on shins/knees that no bias setting fixes
        // cleanly. Losing self-shadow is a smaller visual cost than that.
        (body as THREE.Mesh).castShadow = true;
        (body as THREE.Mesh).receiveShadow = false;

        const geometry = (body as THREE.Mesh).geometry;
        if (!geometry.morphAttributes.position) {
          throw new Error('GLB has no position morph targets -- export step is broken.');
        }

        const newRig = createMorphRig(
          {
            position: geometry.attributes.position.array as Float32Array,
            morphDeltas: geometry.morphAttributes.position.map(
              (attr) => attr.array as Float32Array,
            ),
          },
          metadata,
          gender,
        );

        if (cancelled) return;
        meshRef.current = body;
        setScene(gltf.scene);
        setRig(newRig);
        setProjectors(computeGarmentProjectors(newRig));
        setTorsoMask(computeTorsoMask(newRig));
        setAxes({ ...ZERO_AXES });
        setSolve(null);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[avatar-test] load failed', err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gender]);

  // --- Push axes -> mesh morph influences -------------------------------------
  useEffect(() => {
    if (!rig || !meshRef.current) return;
    const influences = axesToInfluences(rig, axes);
    const mesh = meshRef.current;
    if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== influences.length) {
      mesh.morphTargetInfluences = Array.from(influences);
    } else {
      for (let i = 0; i < influences.length; i++) mesh.morphTargetInfluences[i] = influences[i];
    }
  }, [axes, rig, scene]);

  const live: BodyMeasurementSet | null = useMemo(
    () => (rig ? measure(rig, axes) : null),
    [rig, axes],
  );

  const handleSliderChange = (axis: MorphAxis, value: number) => {
    setAxes((prev) => ({ ...prev, [axis]: value }));
    setSolve(null); // manual tweak invalidates the last validation report
  };

  const handleReset = () => {
    setAxes({ ...ZERO_AXES });
    setSolve(null);
  };

  const handleFormChange = (field: (typeof FORM_FIELDS)[number], value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    if (!rig) return;
    const parsed: Partial<AvatarBodyInput> = { gender };
    for (const field of FORM_FIELDS) {
      const raw = Number(form[field]);
      if (!Number.isFinite(raw) || raw <= 0) {
        setFormError(`${FIELD_LABELS[field]} must be a positive number.`);
        return;
      }
      (parsed as Record<string, number>)[field] = raw;
    }
    setFormError(null);
    setSolving(true);
    // Yield a tick so the button can show a spinner before the ~300-400ms solve.
    setTimeout(() => {
      const result = solveAxes(rig, parsed as AvatarBodyInput);
      setAxes(result.axes);
      setSolve(result);
      setSolving(false);
    }, 30);
  };

  const loadProfile = (input: AvatarBodyInput) => {
    setGender(input.gender);
    setForm(profileToForm(input));
  };

  const currentHeightM = live ? live.height / 100 : 1.75;
  const frameHeight = fixedScale ? REFERENCE_HEIGHT_M : currentHeightM;

  const changeView = (next: CameraView) => {
    setView(next);
    setViewNonce((n) => n + 1);
  };

  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-12">
      {/* Left: form */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Số đo cơ thể</h2>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`flex-1 rounded border px-2 py-1 text-xs ${gender === 'male' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-600'}`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`flex-1 rounded border px-2 py-1 text-xs ${gender === 'female' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-600'}`}
            >
              Female
            </button>
          </div>

          {FORM_FIELDS.map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs">
              <span className="text-stone-600">
                {FIELD_LABELS[field]} ({field === 'weight' ? 'kg' : 'cm'})
              </span>
              <input
                type="number"
                value={form[field]}
                onChange={(e) => handleFormChange(field, e.target.value)}
                className="rounded border border-stone-300 px-2 py-1"
              />
            </label>
          ))}

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={status !== 'ready' || solving}
            className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {solving ? 'Solving…' : 'Generate Avatar'}
          </button>

          <div className="flex gap-2 pt-1">
            {(['A', 'B', 'C'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => loadProfile(PROFILES[key])}
                className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(FEMALE_PROFILES) as Array<keyof typeof FEMALE_PROFILES>).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => loadProfile(FEMALE_PROFILES[key])}
                title={FEMALE_PROFILES[key].label}
                className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                {key}
              </button>
            ))}
          </div>
        </section>

        <GarmentUploadPanel
          ready={status === 'ready'}
          garmentVisible={garmentVisible}
          onToggleVisible={setGarmentVisible}
          onTextureChange={(slot, texture) =>
            slot === 'front' ? setFrontTexture(texture) : setBackTexture(texture)
          }
        />
      </div>

      {/* Middle: canvas */}
      <div className="flex flex-col gap-2 lg:col-span-6">
        <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
          <div className="flex gap-1">
            {(['front', 'side', 'back', 'reset'] as CameraView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => changeView(v)}
                className="rounded border border-stone-300 px-2 py-1 text-xs capitalize text-stone-600 hover:bg-stone-100"
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFixedScale((v) => !v)}
            className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
          >
            Camera: {fixedScale ? 'fixed 2 m' : 'fit to avatar'}
          </button>
        </div>

        <div className="min-h-[480px] flex-1 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          {status === 'error' ? (
            <div className="flex h-full min-h-[480px] items-center justify-center p-6 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : (
            <AvatarCanvas
              object={scene}
              height={frameHeight}
              view={view}
              viewNonce={viewNonce}
              garmentProjectors={projectors}
              garmentTorsoMask={torsoMask}
              garmentFrontTexture={frontTexture}
              garmentBackTexture={backTexture}
              garmentVisible={garmentVisible}
            />
          )}
        </div>
      </div>

      {/* Right: debug + validation */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        <MorphDebugPanel axes={axes} onChange={handleSliderChange} onReset={handleReset} live={live} />
        <ValidationPanel solve={solve} solving={solving} />
      </div>
    </div>
  );
}
