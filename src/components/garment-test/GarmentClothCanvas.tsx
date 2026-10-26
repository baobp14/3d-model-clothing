'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLIP_BINS } from './clipProfile';
import {
  captureRestShape,
  createSimState,
  setBodyYaw,
  stepGarmentSim,
  CAP_FINISH_STEPS,
  GARMENT_REGION,
  type Fabric,
  type BodyCollider,
  type GarmentConstraints,
  type GarmentGeometry,
} from '@/lib/tryon/garmentFit';

/** One simulated garment (e.g. the top, or the bottom) worn on the shared avatar. */
export interface GarmentPieceInput {
  /** Stable per-slot id ("top" / "bottom", ...) -- remounts the sim when it changes. */
  key: string;
  geom: GarmentGeometry;
  constraints: GarmentConstraints;
  fabric: Fabric;
  /** Hide this piece's cloth mesh so the bare body underneath is visible. Default true. */
  showGarment?: boolean;
  showStretch: boolean;
  /** Tint the mesh by which print panel each vertex belongs to. */
  showFaces?: boolean;
  /** Product photo of the garment front, background already removed. */
  frontPrint?: THREE.Texture | null;
  /** Product photo of the garment back. */
  backPrint?: THREE.Texture | null;
  /** Base fabric colour, e.g. sampled from the print so sleeves match. */
  baseColor?: string;
  /** Zoom the print UV about its centre (1 = as unwrapped, >1 = smaller pattern). */
  printScale?: number;
  /** Shift the print UV, in UV units (0.05 ~= a few cm on the shirt). */
  printOffset?: [number, number];
  /** _REGION id of the ring the garment hangs from (collar=5, waistband=0). */
  pinRegion?: number;
  /** World Y of that ring on the body (shoulder line for a top, waist for trousers). */
  anchorY?: number;
  /** Draw a button placket down the centre front (dress shirt). */
  placket?: boolean;
  /** Woven / knitted surface pattern (see FABRIC_PATTERNS). */
  pattern?: FabricPatternKey;
  /** Second yarn colour for stripes, checks and plaids. */
  color2?: string;
  /**
   * World Y above which this piece is not drawn. Set on the bottom when a top
   * is worn over it: the two cloths do not collide with each other, so where
   * they overlap the waistband pokes through the shirt tail in a sawtooth.
   * An untucked top hides that band anyway.
   */
  clipAboveY?: number;
  /**
   * Same idea, but a whole hem line: world Y per angle round the body axis
   * (CLIP_BINS bins, angle 0 = straight ahead, body frame). Wins over
   * clipAboveY. See GarmentTestApp's topHemProfile.
   */
  clipProfile?: Float32Array;
  /**
   * How far (m) the bottom is drawn pulled in under the top's hem. Loose
   * cuts (skirt) stand well off the body and need ~3.5cm; tight trousers
   * show the thigh through them past ~1cm.
   */
  clipPull?: number;
}

export interface ClothViewProps {
  avatar: THREE.Object3D;
  colliders: BodyCollider;
  /** One entry per worn garment -- a top and a bottom can be simulated together. */
  pieces: GarmentPieceInput[];
  spinning: boolean;
  /** Radians per second while spinning. */
  spinSpeed: number;
  /** Bumping this number snaps the body through a half turn. */
  turnNonce: number;
  wireframe: boolean;
  /** World Y of the morphed body's lowest vertex; the floor disc sits here. */
  groundY?: number;
  /** Camera framing: whole body, or a close-up to inspect a detail. */
  view?: CameraView;
}

export type CameraView = 'full' | 'neck' | 'neckBack' | 'arm' | 'legs';

/** [camera position, orbit target] per framing, relative to the body. */
function framing(view: CameraView, c: BodyCollider): [THREE.Vector3, THREE.Vector3] {
  const sh = c.shoulderY;
  const z = c.axisZ;
  switch (view) {
    case 'neck':
      return [new THREE.Vector3(0.15, sh + 0.12, z + 0.55), new THREE.Vector3(0, sh + 0.04, z)];
    case 'neckBack':
      return [new THREE.Vector3(-0.15, sh + 0.14, z - 0.55), new THREE.Vector3(0, sh + 0.04, z)];
    case 'arm':
      return [new THREE.Vector3(0.75, sh - 0.2, z + 0.75), new THREE.Vector3(0.35, sh - 0.3, z)];
    case 'legs':
      return [new THREE.Vector3(0.5, c.waistY - 0.35, z + 1.5), new THREE.Vector3(0, c.waistY - 0.45, z)];
    default:
      return [new THREE.Vector3(0.9, 1.35, 2.3), new THREE.Vector3(0, 1.0, 0)];
  }
}

function CameraFraming({ view, colliders }: { view: CameraView; colliders: BodyCollider }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    const [pos, target] = framing(view, colliders);
    camera.position.copy(pos);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }
  }, [view, colliders, camera, controls]);
  return null;
}

const EMPTY_TEX = new THREE.Texture();

/**
 * Fabric surfaces, drawn procedurally in the fragment shader from the cloth's
 * REST position (so the weave is stuck to the threads while the cloth moves)
 * and projected three ways by the rest normal, so a stripe runs on round the
 * side seams instead of smearing. No image assets: every pattern is a closed
 * form in centimetres, anti-aliased with fwidth so fine twill fades to its
 * average colour at a distance instead of shimmering.
 */
export const FABRIC_PATTERNS = {
  plain: { id: 0, label: 'Trơn' },
  heather: { id: 1, label: 'Melange' },
  stripeH: { id: 2, label: 'Sọc ngang' },
  pinstripe: { id: 3, label: 'Sọc dọc nhỏ' },
  gingham: { id: 4, label: 'Caro nhỏ' },
  plaid: { id: 5, label: 'Caro to (tartan)' },
  denim: { id: 6, label: 'Jean' },
  twill: { id: 7, label: 'Kaki' },
  oxford: { id: 8, label: 'Oxford' },
  corduroy: { id: 9, label: 'Nhung tăm' },
  linen: { id: 10, label: 'Linen' },
  rib: { id: 11, label: 'Thun gân' },
} as const;
export type FabricPatternKey = keyof typeof FABRIC_PATTERNS;

/** Milliseconds of settling a single frame may spend before yielding. */
const SETTLE_BUDGET_MS = 14;

// Stretch ratio mapped to colour: 1.0 slack -> 1.2 at the knit limit.
const COLD = new THREE.Color('#8fb6e8');
const HOT = new THREE.Color('#e8503f');

/**
 * A woven-thread bump map, drawn once at load.
 *
 * Flat shading on a smooth mesh reads as plastic no matter how the roughness
 * is set, because real fabric is rough at a scale far below the mesh. Weave
 * lines at ~1 mm give the eye that scale back; the garment carries MakeHuman's
 * own UV unwrap, so the pattern lies along the body rather than smearing.
 */
function makeWeaveBump(): THREE.Texture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const period = 4; // pixels per thread
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Over-under weave: which thread is on top alternates each cell.
      const cell = (Math.floor(x / period) + Math.floor(y / period)) % 2;
      const along = cell === 0 ? x : y;
      const thread = Math.sin(((along % period) / period) * Math.PI);
      const grain = (Math.random() - 0.5) * 0.18; // slubs in the yarn
      const v = Math.max(0, Math.min(1, 0.45 + thread * 0.45 + grain));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = 4;
  return tex;
}

/**
 * One simulated + rendered garment. Does NOT own the avatar or the body's
 * yaw -- several of these can share one avatar (a top + a bottom worn
 * together), so yaw/turning live once in `Rig` and are read here through
 * refs instead of each piece re-deriving its own.
 */
function GarmentPiece({
  geom,
  constraints,
  colliders,
  pinRegion,
  anchorY,
  placket = false,
  pattern = 'plain',
  color2 = '#ffffff',
  clipAboveY = Infinity,
  clipProfile,
  clipPull = 0.012,
  fabric,
  showGarment = true,
  showStretch,
  showFaces = false,
  wireframe,
  frontPrint = null,
  backPrint = null,
  baseColor = '#41599c',
  printScale = 1,
  printOffset = [0, 0],
  yawRef,
  turningRef,
}: GarmentPieceInput & {
  colliders: BodyCollider;
  wireframe: boolean;
  yawRef: React.RefObject<number>;
  turningRef: React.RefObject<boolean>;
}) {
  const weave = useMemo(makeWeaveBump, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(geom.positions), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pos);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geom.positions.length), 3));
    if (geom.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geom.uv), 2));

    // The print's own texture coords: the shirt-panel unwrap baked as _ARTUV,
    // so an uploaded photo maps to the front panel roughly 1:1. Fall back to
    // the planar `uv` for older meshes without _ARTUV.
    g.setAttribute('_artuv', new THREE.BufferAttribute(
      new Float32Array(geom.artUv ?? geom.uv ?? new Float32Array(geom.regions.length * 2)), 2));

    // Front/back weight for the print.
    //
    // A mesh built with _ARTUV also bakes _FACING from POSITION (which side of
    // the body axis the vertex sits on) -- stable, unlike a weight taken from
    // the vertex normal, which wobbles on this vertex-clustered mesh. Older
    // meshes have no such bake, so recompute the same thing here from z.
    const FACE_BAND = 0.05;
    const facing = new Float32Array(geom.regions.length);
    for (let v = 0; v < facing.length; v++) {
      if (geom.artUv && geom.facing) {
        facing[v] = geom.facing[v];
      } else {
        const t = Math.max(
          0,
          Math.min(1, (geom.positions[v * 3 + 2] + FACE_BAND) / FACE_BAND),
        );
        facing[v] = t * t * (3 - 2 * t);
      }
    }
    g.setAttribute('_facing', new THREE.BufferAttribute(facing, 1));

    // Where a print is allowed to land. Only the collar ring is off, so an
    // uploaded photo cannot stamp a second neckline on top of the mesh's own.
    // Everything else -- torso, sleeves, shoulder yoke -- takes the print,
    // split front / back by _FACING, because the _ARTUV unwrap is a flat lay
    // of the whole garment and a shirt photo covers all of it. A per-vertex
    // 0/1 interpolates, so the print fades out over the last ~1 cm before the
    // neckline rather than stopping on a hard line.
    const printMask = new Float32Array(geom.regions.length);
    for (let v = 0; v < geom.regions.length; v++) {
      const r = geom.regions[v];
      printMask[v] = r === GARMENT_REGION.collar || r === GARMENT_REGION.collarLeaf ? 0 : 1;
    }
    g.setAttribute('_printmask', new THREE.BufferAttribute(printMask, 1));

    // Ribbed-elastic look for the waistband. Region id 0 ("waistband") tags
    // only the single topmost boundary loop -- zero-height by definition, a
    // hairline of triangles a pixel or two tall on screen -- so masking the
    // rib by region alone marks a strip too thin to ever be visible (verified
    // by sampling the rendered pixels: no variance increase over plain
    // fabric). Mask by height instead, over the same band the waist cinch
    // itself uses in the build script (RIB_BAND m below the highest
    // waistband-tagged vertex), which is the entire span that actually reads
    // as "the waistband" on screen.
    const waistband = new Float32Array(geom.regions.length);
    if (pinRegion === 0) {
      const RIB_BAND = 0.045;
      let topY = -Infinity;
      for (let v = 0; v < geom.regions.length; v++) {
        if (geom.regions[v] === 0) topY = Math.max(topY, geom.positions[v * 3 + 1]);
      }
      for (let v = 0; v < waistband.length; v++) {
        waistband[v] = geom.positions[v * 3 + 1] > topY - RIB_BAND ? 1 : 0;
      }
    }
    g.setAttribute('_waistband', new THREE.BufferAttribute(waistband, 1));

    // Rest-pose (x, y) for the placket and buttons. The live position moves
    // with the sim and turns with the body, so a stripe keyed on it would
    // swim across the cloth; the rest coords stay stuck to the threads.
    const rest = new Float32Array(geom.regions.length * 2);
    for (let v = 0; v < geom.regions.length; v++) {
      rest[v * 2] = geom.positions[v * 3];
      rest[v * 2 + 1] = geom.positions[v * 3 + 1];
    }
    g.setAttribute('_rest', new THREE.BufferAttribute(rest, 2));

    // Rest position + rest normal for the fabric pattern (triplanar).
    const restGeo = new THREE.BufferGeometry();
    restGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geom.positions), 3));
    restGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(geom.indices), 1));
    restGeo.computeVertexNormals();
    g.setAttribute('_restpos', new THREE.BufferAttribute(new Float32Array(geom.positions), 3));
    g.setAttribute('_restnrm', restGeo.getAttribute('normal').clone());
    restGeo.dispose();

    // Collar leaf outline. The leaf is the same cloth colour as the body and
    // the scene casts no shadows, so on screen it dissolved into the shirt --
    // a shirt with a proper pointed collar read as collarless. Mark the leaf's
    // open border (edges used by one triangle) so the shader can draw the
    // shadowed edge and a topstitch just inside it.
    const leafEdge = new Float32Array(geom.regions.length);
    const isLeaf = new Uint8Array(geom.regions.length);
    for (let v = 0; v < geom.regions.length; v++) {
      if (geom.regions[v] === GARMENT_REGION.collarLeaf) isLeaf[v] = 1;
    }
    const edgeUse = new Map<number, number>();
    const nV = geom.regions.length;
    for (let t = 0; t < geom.indices.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = geom.indices[t + k];
        const b = geom.indices[t + ((k + 1) % 3)];
        if (!isLeaf[a] || !isLeaf[b]) continue;
        const key = a < b ? a * nV + b : b * nV + a;
        edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      }
    }
    for (const [key, n] of edgeUse) {
      if (n !== 1) continue;
      leafEdge[Math.floor(key / nV)] = 1;
      leafEdge[key % nV] = 1;
    }
    g.setAttribute('_leafedge', new THREE.BufferAttribute(leafEdge, 1));
    g.setAttribute('_leaf', new THREE.BufferAttribute(Float32Array.from(isLeaf), 1));

    g.setIndex(new THREE.BufferAttribute(new Uint32Array(geom.indices), 1));
    return g;
  }, [geom, pinRegion]);

  // Top of the placket: where the centre front meets the collar.
  const placketTop = useMemo(() => {
    let top = -Infinity;
    for (let v = 0; v < geom.regions.length; v++) {
      const r = geom.regions[v];
      if (r === GARMENT_REGION.collar || r === GARMENT_REGION.collarLeaf) continue;
      const x = geom.positions[v * 3];
      const z = geom.positions[v * 3 + 2];
      if (Math.abs(x) < 0.02 && z > 0) top = Math.max(top, geom.positions[v * 3 + 1]);
    }
    return Number.isFinite(top) ? top : 0;
  }, [geom]);

  // One mutable colliders object: the yaw changes every frame and allocating a
  // fresh one per frame would churn the heap for no reason.
  const live = useRef<BodyCollider>({ ...colliders, yaw: 0 });

  // Steps of settling before the shirt is ready to be worn.
  //
  // 100, not 160. Measured against a 220-step reference across three bodies
  // and two sizes, step 100 is within 1.5 cm everywhere and step 160 within
  // 0.5 cm -- and the sim keeps running live at 60 Hz, so that last centimetre
  // settles within the next few frames. Raising dt to settle in fewer steps
  // was tried and is much worse, not cheaper: a loose shirt overshoots and 60
  // steps at 1/30 s lands 17 cm out.
  const WARMUP_STEPS = 100;
  const settling = useRef(WARMUP_STEPS + CAP_FINISH_STEPS);

  const sim = useMemo(() => {
    const state = createSimState(
      geom,
      colliders,
      constraints,
      undefined,
      pinRegion,
      anchorY,
    );
    live.current = { ...colliders, yaw: 0 };
    settling.current = WARMUP_STEPS + CAP_FINISH_STEPS;
    return state;
  }, [geom, constraints, colliders, fabric, pinRegion, anchorY]);

  // The print is blended into the base colour by a per-vertex front/back
  // weight rather than projected from a camera. A projector would keep the
  // image fixed in space while the cloth moves through it, so the artwork
  // would visibly slide across the shirt as the body turns; a UV plus a baked
  // weight stays stuck to the threads, which is what a real print does.
  const printUniforms = useRef({
    frontMap: { value: EMPTY_TEX },
    backMap: { value: EMPTY_TEX },
    hasPrint: { value: 0 },
    placket: { value: 0 },
    pattern: { value: 0 },
    color2: { value: new THREE.Color('#ffffff') },
    placketTop: { value: 0 },
    clipAboveY: { value: 1e6 },
    clipPull: { value: 0.012 },
    clipOn: { value: 0 },
    clipProf: { value: new Array(CLIP_BINS).fill(1e6) as number[] },
    yaw: { value: 0 },
    axisZ: { value: 0 },
    showFaces: { value: 0 },
    artScale: { value: 1 },
    artOffset: { value: new THREE.Vector2(0, 0) },
  });

  useEffect(() => {
    printUniforms.current.frontMap.value = frontPrint ?? EMPTY_TEX;
    printUniforms.current.backMap.value = backPrint ?? EMPTY_TEX;
    // Suppress the print while an overlay is on, so the tint is what shows.
    printUniforms.current.hasPrint.value =
      (frontPrint || backPrint) && !showFaces && !showStretch ? 1 : 0;
    printUniforms.current.showFaces.value = showFaces && !showStretch ? 1 : 0;
    printUniforms.current.placket.value = placket ? 1 : 0;
    printUniforms.current.pattern.value = FABRIC_PATTERNS[pattern]?.id ?? 0;
    printUniforms.current.color2.value.set(color2);
    printUniforms.current.placketTop.value = placketTop;
    printUniforms.current.clipAboveY.value = Number.isFinite(clipAboveY) ? clipAboveY : 1e6;
    printUniforms.current.clipOn.value = clipProfile ? 1 : 0;
    printUniforms.current.clipPull.value = clipPull;
    if (clipProfile) {
      for (let b = 0; b < CLIP_BINS; b++) printUniforms.current.clipProf.value[b] = clipProfile[b];
    }
    printUniforms.current.axisZ.value = colliders.axisZ;
    printUniforms.current.artScale.value = printScale;
    printUniforms.current.artOffset.value.set(printOffset[0], printOffset[1]);
  }, [frontPrint, backPrint, showFaces, showStretch, printScale, printOffset, placket, placketTop, clipAboveY, clipProfile, clipPull, colliders, pattern, color2]);

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.frontMap = printUniforms.current.frontMap;
      shader.uniforms.backMap = printUniforms.current.backMap;
      shader.uniforms.hasPrint = printUniforms.current.hasPrint;
      shader.uniforms.uShowFaces = printUniforms.current.showFaces;
      shader.uniforms.uPlacket = printUniforms.current.placket;
      shader.uniforms.uPlacketTop = printUniforms.current.placketTop;
      shader.uniforms.uClipAboveY = printUniforms.current.clipAboveY;
      shader.uniforms.uClipOn = printUniforms.current.clipOn;
      shader.uniforms.uClipPull = printUniforms.current.clipPull;
      shader.uniforms.uClipProf = printUniforms.current.clipProf;
      shader.uniforms.uYaw = printUniforms.current.yaw;
      shader.uniforms.uAxisZ = printUniforms.current.axisZ;
      shader.uniforms.uPattern = printUniforms.current.pattern;
      shader.uniforms.uColor2 = printUniforms.current.color2;
      shader.uniforms.uArtScale = printUniforms.current.artScale;
      shader.uniforms.uArtOffset = printUniforms.current.artOffset;

      shader.vertexShader =
        `#define CLIP_BINS_N ${CLIP_BINS}
uniform float uClipOn;
uniform float uClipPull;
uniform float uClipProf[CLIP_BINS_N];
uniform float uYaw;
uniform float uAxisZ;
attribute float _facing;
attribute float _printmask;
attribute vec2 _artuv;
attribute float _waistband;
attribute vec2 _rest;
attribute vec3 _restpos;
attribute vec3 _restnrm;
varying vec3 vRestPos;
varying vec3 vRestNrm;
attribute float _leafedge;
attribute float _leaf;
varying float vLeafEdge;
varying float vLeaf;
varying vec2 vRest;
varying float vWorldY;
varying vec3 vWorldPos;
varying float vFacing;
varying float vPrintMask;
varying vec2 vArtUv;
varying float vWaistband;
varying float vLocalY;
` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vFacing = _facing;
  vPrintMask = _printmask;
  vArtUv = _artuv;
  vWaistband = _waistband;
  vRest = _rest;
  vLeafEdge = _leafedge;
  vRestPos = _restpos;
  vRestNrm = _restnrm;
  vLeaf = _leaf;
  // Bottom worn under a top: the two cloths do not collide, and the top's
  // simulated hem flares out and hangs lower than its rest shape -- so in the
  // band just under the hem the bottom's cloth can sit OUTSIDE the shirt and
  // poke through it in a sawtooth. Draw that band pulled in toward the body
  // axis so it always reads as underneath. (Render-only; the simulation is
  // untouched.)
  if (uClipOn > 0.5) {
    vec3 w = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float cy = cos(uYaw); float sy = sin(uYaw);
    float bx = w.x * cy - w.z * sy;
    float bz = w.x * sy + w.z * cy - uAxisZ;
    float a = atan(bx, bz);
    if (a < 0.0) a += 6.2831853;
    float f = a / 6.2831853 * float(CLIP_BINS_N);
    int i0 = int(floor(f));
    float t = f - float(i0);
    float y0 = 0.0; float y1 = 0.0;
    for (int k = 0; k < CLIP_BINS_N; k++) {
      if (k == i0 - (i0 / CLIP_BINS_N) * CLIP_BINS_N) y0 = uClipProf[k];
      if (k == (i0 + 1) - ((i0 + 1) / CLIP_BINS_N) * CLIP_BINS_N) y1 = uClipProf[k];
    }
    float hem = mix(y0, y1, t);
    // 0 well below the hem, 1 from 3cm under it upward.
    float band = smoothstep(hem - 0.10, hem - 0.03, w.y);
    float r = length(vec2(bx, bz));
    if (band > 0.0 && r > 1e-4) {
      float k = max(r - uClipPull * band, r * 0.85) / r;
      bx *= k; bz *= k;
      bz += uAxisZ;
      w.x = bx * cy + bz * sy;
      w.z = -bx * sy + bz * cy;
      transformed = (inverse(modelMatrix) * vec4(w, 1.0)).xyz;
    }
  }
  vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vLocalY = position.y;`,
        );

      shader.fragmentShader =
        `#define CLIP_BINS_N ${CLIP_BINS}
uniform sampler2D frontMap;
uniform sampler2D backMap;
uniform float hasPrint;
uniform float uShowFaces;
uniform float uPlacket;
uniform float uPlacketTop;
uniform float uClipAboveY;
uniform float uClipOn;
uniform float uClipProf[CLIP_BINS_N];
uniform float uYaw;
uniform float uAxisZ;
varying vec3 vWorldPos;
uniform int uPattern;
uniform vec3 uColor2;
varying vec3 vRestPos;
varying vec3 vRestNrm;

float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fhash(i), fhash(i + vec2(1.0, 0.0)), f.x),
             mix(fhash(i + vec2(0.0, 1.0)), fhash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// 1 inside a band of width w (fraction of the period), anti-aliased.
float band(float x, float period, float w) {
  float t = fract(x / period);
  float fw = max(fwidth(x / period), 1e-4);
  return smoothstep(0.0, fw, t) - smoothstep(w, w + fw, t);
}
// How much of a pattern of this period survives at the current pixel size.
float keep(float x, float period) { return clamp(1.5 - fwidth(x / period) * 2.0, 0.0, 1.0); }

// One projection plane: u runs across (x or z), v up (y), in centimetres.
vec3 fabric(vec2 uv, vec3 c1) {
  float u = uv.x; float v = uv.y;
  if (uPattern == 1) { // heather: two-tone speckled yarn
    float n = fnoise(uv * 6.0) * 0.6 + fnoise(uv * 23.0) * 0.4;
    return c1 * mix(0.86, 1.12, n);
  }
  if (uPattern == 2) { // horizontal stripe, 1.6 cm repeat
    return mix(c1, uColor2, band(v, 1.6, 0.4));
  }
  if (uPattern == 3) { // pinstripe, 1 cm
    return mix(c1, uColor2, 0.85 * band(u, 1.0, 0.12));
  }
  if (uPattern == 4) { // gingham 0.8 cm: overlaps darkest
    float a = band(u, 0.8, 0.5); float b = band(v, 0.8, 0.5);
    return mix(c1, uColor2, 0.45 * (a + b) + 0.1 * a * b);
  }
  if (uPattern == 5) { // tartan
    float bu = band(u, 9.0, 0.35); float bv = band(v, 9.0, 0.35);
    float big = max(bu, bv);
    float thin = max(band(u + 2.2, 9.0, 0.04), band(v + 2.2, 9.0, 0.04));
    vec3 c = mix(c1, c1 * 0.55, big * 0.7 + bu * bv * 0.3);
    return mix(c, uColor2, thin * 0.9);
  }
  if (uPattern == 6) { // denim: indigo twill + white weft + slub streaks
    float d = u * 0.7 + v;
    float tw = band(d, 0.12, 0.5) * keep(d, 0.12);
    float streak = fnoise(vec2(u * 0.8, v * 0.07));
    vec3 c = c1 * mix(0.82, 1.15, streak);
    return mix(c, mix(c, vec3(0.85), 0.35), tw);
  }
  if (uPattern == 7) { // khaki twill: fine diagonal rib
    float d = u + v;
    float tw = band(d, 0.1, 0.5) * keep(d, 0.1);
    return c1 * mix(1.0, 0.86, tw) * mix(0.96, 1.04, fnoise(uv * 3.0));
  }
  if (uPattern == 8) { // oxford: two-tone basket weave
    vec2 cell = floor(uv / 0.08);
    float k = mod(cell.x + cell.y, 2.0);
    float fade = keep(u, 0.16);
    vec3 c = mix(c1, mix(c1, uColor2, 0.35), k * fade + 0.35 * (1.0 - fade));
    return c * mix(0.97, 1.03, fnoise(uv * 5.0));
  }
  if (uPattern == 9) { // corduroy: vertical wales 0.4 cm
    float t = fract(u / 0.4);
    float wale = sin(t * 3.14159);
    return c1 * mix(1.0, mix(0.72, 1.12, wale), keep(u, 0.4));
  }
  if (uPattern == 10) { // linen: irregular slub lines both ways
    float h = fnoise(vec2(u * 0.3, v * 9.0));
    float w = fnoise(vec2(u * 9.0, v * 0.3));
    return c1 * (0.9 + 0.1 * h + 0.08 * w);
  }
  if (uPattern == 11) { // knit rib: vertical ribs 0.3 cm
    float t = fract(u / 0.3);
    float r = smoothstep(0.2, 0.5, t) - smoothstep(0.7, 1.0, t);
    return c1 * mix(1.0, mix(0.84, 1.06, r), keep(u, 0.3));
  }
  return c1;
}
varying float vLeafEdge;
varying float vLeaf;
varying float vWorldY;
varying vec2 vRest;
uniform float uArtScale;
uniform vec2 uArtOffset;
varying float vFacing;
varying float vPrintMask;
varying vec2 vArtUv;
varying float vWaistband;
varying float vLocalY;
` +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
  if (vWorldY > uClipAboveY) discard;
  if (uClipOn > 0.5) {
    // Into the body's own frame (the body turns by uYaw about the origin).
    float cy = cos(uYaw); float sy = sin(uYaw);
    float bx = vWorldPos.x * cy - vWorldPos.z * sy;
    float bz = vWorldPos.x * sy + vWorldPos.z * cy - uAxisZ;
    float a = atan(bx, bz);
    if (a < 0.0) a += 6.2831853;
    float f = a / 6.2831853 * float(CLIP_BINS_N);
    int i0 = int(floor(f));
    float t = f - float(i0);
    float y0 = 0.0; float y1 = 0.0;
    for (int k = 0; k < CLIP_BINS_N; k++) {
      if (k == i0 - (i0 / CLIP_BINS_N) * CLIP_BINS_N) y0 = uClipProf[k];
      if (k == (i0 + 1) - ((i0 + 1) / CLIP_BINS_N) * CLIP_BINS_N) y1 = uClipProf[k];
    }
    if (vWorldY > mix(y0, y1, t)) discard;
  }
  // Ribbed elastic waistband: horizontal bands running around the waist,
  // since the weave bump map is a generic fabric grain that doesn't read as
  // elastic ribbing at any scale/rotation. Baked from the rest-position Y
  // (stable even while the fabric is simulating), so it stays put on the
  // cloth like a real knit rib instead of swimming as the body turns.
  //
  // 785 rad/m (~8mm period), not a finer/more realistic ~2-3mm: at this
  // canvas's actual pixel density a finer period sampled less than ~4px per
  // cycle and the GPU's one-sample-per-fragment rasterization aliased it
  // away to a flat average -- confirmed by reading back rendered pixels and
  // finding LOWER variance in the waistband than in plain fabric elsewhere.
  if (vWaistband > 0.5) {
    float rib = sin(vLocalY * 785.0);
    diffuseColor.rgb *= 1.0 + 0.16 * rib;
  }
  if (uPattern > 0) {
    // Triplanar in centimetres: front/back (x,y), sides (z,y), shoulders (x,z).
    vec3 tw3 = pow(abs(normalize(vRestNrm)), vec3(4.0));
    tw3 /= (tw3.x + tw3.y + tw3.z + 1e-5);
    vec3 pc = vRestPos * 100.0;
    vec3 base1 = diffuseColor.rgb;
    diffuseColor.rgb = fabric(pc.xy, base1) * tw3.z + fabric(pc.zy, base1) * tw3.x
      + fabric(pc.xz, base1) * tw3.y;
  }
  if (hasPrint > 0.5) {
    // Zoom about the centre, then shift. >1 shows more image = smaller pattern.
    vec2 puv = (vArtUv - 0.5) * uArtScale + 0.5 + uArtOffset;
    vec4 f = texture2D(frontMap, puv);
    vec4 b = texture2D(backMap, vec2(1.0 - puv.x, puv.y));
    vec4 art = mix(b, f, vFacing);
    diffuseColor.rgb = mix(diffuseColor.rgb, art.rgb, art.a * vPrintMask);
  }
  // Dress-shirt placket: a 3.4 cm band down the centre front with a stitch
  // line on each edge and a button every 9 cm. Drawn after the print, the
  // way a real placket sits on top of the printed body panel.
  // Skipped under a print: a real shirt photo already carries its own placket.
  if (uPlacket > 0.5 && hasPrint < 0.5 && vFacing > 0.5 && vPrintMask > 0.5) {
    float ax = abs(vRest.x);
    float dy = uPlacketTop - vRest.y;
    if (ax < 0.017 && dy > 0.0) {
      diffuseColor.rgb *= 1.06;
      float seam = smoothstep(0.0012, 0.0, abs(ax - 0.0145));
      diffuseColor.rgb *= 1.0 - 0.35 * seam;
      float k = dy - 0.035;
      if (k > -0.01) {
        float cy = floor(k / 0.09 + 0.5) * 0.09;
        float d = length(vec2(vRest.x, k - cy));
        float btn = smoothstep(0.0062, 0.0052, d);
        float rim = smoothstep(0.0062, 0.0052, d) - smoothstep(0.0048, 0.0040, d);
        float holes = smoothstep(0.0011, 0.0007, length(vec2(abs(vRest.x) - 0.0016, abs(k - cy) - 0.0016)));
        vec3 bc = vec3(0.93, 0.92, 0.88);
        diffuseColor.rgb = mix(diffuseColor.rgb, bc * (1.0 - 0.25 * rim), btn);
        diffuseColor.rgb = mix(diffuseColor.rgb, bc * 0.45, holes * btn);
      }
    }
  }
  // Collar leaf: interfaced, so a touch lighter than the body; a shadowed
  // rim on its open border and a topstitch line just inside it.
  if (vLeaf > 0.5) {
    diffuseColor.rgb *= 1.08;
    diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.80, 0.97, vLeafEdge);
    diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.05, abs(vLeafEdge - 0.55)));
  }
  // Panel overlay: cyan = takes the FRONT image, orange = the BACK image,
  // grey = no print (sleeve / collar / yoke).
  if (uShowFaces > 0.5) {
    vec3 fc = vPrintMask < 0.5
      ? vec3(0.60, 0.63, 0.68)
      : (vFacing >= 0.5 ? vec3(0.13, 0.83, 0.93) : vec3(0.98, 0.45, 0.09));
    diffuseColor.rgb = fc;
  }`,
        );
    },
    [],
  );

  const pushToGeometry = () => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(sim.positions);
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  useFrame((_, delta) => {
    printUniforms.current.yaw.value = yawRef.current ?? 0;
    const dt = Math.min(delta, 1 / 30);

    // Settling runs ACROSS frames, not before the first one.
    //
    // Those 108 steps used to run inside the useMemo above, which froze the
    // whole page for about two seconds every time the size, the body or the
    // fabric changed -- and that is every click in the panel. Nothing about
    // them needs to happen before the first paint: the body is already on
    // screen, and the shirt starts out cut from that same body, so what the
    // viewer sees is a shirt settling onto a model rather than a dead page.
    //
    // Budgeted by time rather than by a fixed number of steps per frame: one
    // step costs about 21 ms on this mesh but that is a measurement of one
    // machine, and a slower one must not end up with frames a quarter of a
    // second long. It spends up to a frame's worth and stops.
    if (settling.current > 0) {
      const until = performance.now() + SETTLE_BUDGET_MS;
      do {
        const thorough = settling.current <= CAP_FINISH_STEPS;
        stepGarmentSim(sim, constraints, live.current, {
          fabric,
          ...(thorough ? { capSweeps: 10 } : null),
        });
        settling.current--;
      } while (settling.current > 0 && performance.now() < until);

      if (settling.current === 0) captureRestShape(sim);
      pushToGeometry();
      return;
    }

    live.current.yaw = yawRef.current;
    setBodyYaw(sim, yawRef.current);

    // Two substeps only while the body is actually turning. One 60 Hz step is
    // enough for a hanging shirt; the second exists so the hem cannot tunnel
    // through the hips during a fast turn. Paying for it while the model
    // stands still doubled the cost of the most common frame for nothing.
    if (turningRef.current) {
      stepGarmentSim(sim, constraints, live.current, { fabric, dt: dt / 2 });
      stepGarmentSim(sim, constraints, live.current, { fabric, dt: dt / 2 });
    } else {
      stepGarmentSim(sim, constraints, live.current, { fabric, dt });
    }

    pushToGeometry();

    if (showStretch) {
      const col = geometry.getAttribute('color') as THREE.BufferAttribute;
      const arr = col.array as Float32Array;
      const c = new THREE.Color();
      for (let v = 0; v < sim.stretch.length; v++) {
        const t = Math.max(0, Math.min(1, (sim.stretch[v] - 1) / (fabric.maxStretch - 1)));
        c.copy(COLD).lerp(HOT, t);
        arr[v * 3] = c.r;
        arr[v * 3 + 1] = c.g;
        arr[v * 3 + 2] = c.b;
      }
      col.needsUpdate = true;
    }
  });

  return (
    <mesh geometry={geometry} castShadow visible={showGarment}>
      <meshPhysicalMaterial
        side={THREE.DoubleSide}
        color={showStretch ? '#ffffff' : baseColor}
        vertexColors={showStretch}
        roughness={0.96}
        metalness={0}
        // Sheen is what separates cloth from paint: cotton scatters a pale
        // rim of light at grazing angles instead of a specular highlight.
        sheen={0.6}
        sheenRoughness={0.85}
        sheenColor={'#c9d4ea'}
        bumpMap={wireframe || showStretch || showFaces ? null : weave}
        bumpScale={0.35}
        wireframe={wireframe}
        onBeforeCompile={onBeforeCompile}
        // Must change when vertexColors flips, or three reuses the compiled
        // program without the USE_COLOR define.
        customProgramCacheKey={() => `garment-print-v2-${showStretch ? 'vc' : 'plain'}`}
      />
    </mesh>
  );
}

/**
 * Owns the avatar and its yaw (spin / snap-turn) once, shared by every
 * garment piece worn on it -- each piece used to drive its own copy of this
 * (back when only one garment could be worn at a time), which would fight
 * over the body's rotation the moment a second piece was added.
 */
function Rig({
  avatar,
  colliders,
  pieces,
  spinning,
  spinSpeed,
  turnNonce,
  wireframe,
}: ClothViewProps) {
  const bodyRef = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const targetYaw = useRef(0);
  const turning = useRef(false);
  const firstTurn = useRef(turnNonce);

  useEffect(() => {
    if (turnNonce === firstTurn.current) return;
    firstTurn.current = turnNonce;
    targetYaw.current += Math.PI;
  }, [turnNonce]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (spinning) targetYaw.current += spinSpeed * dt;
    // Ease toward the target so a snap turn is fast but not instantaneous --
    // an instantaneous jump gives the cloth infinite velocity and it explodes.
    // Rate 7 was tuned on the old 1.7k procedural mesh; on the body-derived
    // one it threw the shoulders out far enough that they did not settle back.
    yaw.current += (targetYaw.current - yaw.current) * Math.min(1, dt * 3);
    if (bodyRef.current) bodyRef.current.rotation.y = yaw.current;
    turning.current = Math.abs(targetYaw.current - yaw.current) > 0.002 || spinning;
  });

  return (
    <>
      {/* Wireframe hides the body: when the question is whether a garment
          mesh has a hole, the body is exactly what gets in the way of seeing
          it. */}
      <group ref={bodyRef} visible={!wireframe}>
        <primitive object={avatar} />
      </group>
      {pieces.map(({ key, ...p }) => (
        <GarmentPiece
          key={key}
          {...p}
          colliders={colliders}
          wireframe={wireframe}
          yawRef={yaw}
          turningRef={turning}
        />
      ))}
    </>
  );
}

export default function GarmentClothCanvas(props: ClothViewProps) {
  const groundY = props.groundY ?? 0;
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0.9, 1.35, 2.3], fov: 35, near: 0.02, far: 60 }}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#b9b2aa', 0.5]} />
      <directionalLight position={[2.4, 3.6, 2.6]} intensity={1.3} />
      <directionalLight position={[-2.6, 1.8, -1.6]} intensity={0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#e9e6e2" roughness={1} />
      </mesh>
      <Rig {...props} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 1.0, 0]} />
      <CameraFraming view={props.view ?? 'full'} colliders={props.colliders} />
    </Canvas>
  );
}
