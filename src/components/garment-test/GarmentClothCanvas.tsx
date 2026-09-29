'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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
  /**
   * World Y above which this piece is not drawn. Set on the bottom when a top
   * is worn over it: the two cloths do not collide with each other, so where
   * they overlap the waistband pokes through the shirt tail in a sawtooth.
   * An untucked top hides that band anyway.
   */
  clipAboveY?: number;
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
}

const EMPTY_TEX = new THREE.Texture();

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
  clipAboveY = Infinity,
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
    placketTop: { value: 0 },
    clipAboveY: { value: 1e6 },
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
    printUniforms.current.placketTop.value = placketTop;
    printUniforms.current.clipAboveY.value = Number.isFinite(clipAboveY) ? clipAboveY : 1e6;
    printUniforms.current.artScale.value = printScale;
    printUniforms.current.artOffset.value.set(printOffset[0], printOffset[1]);
  }, [frontPrint, backPrint, showFaces, showStretch, printScale, printOffset, placket, placketTop, clipAboveY]);

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.frontMap = printUniforms.current.frontMap;
      shader.uniforms.backMap = printUniforms.current.backMap;
      shader.uniforms.hasPrint = printUniforms.current.hasPrint;
      shader.uniforms.uShowFaces = printUniforms.current.showFaces;
      shader.uniforms.uPlacket = printUniforms.current.placket;
      shader.uniforms.uPlacketTop = printUniforms.current.placketTop;
      shader.uniforms.uClipAboveY = printUniforms.current.clipAboveY;
      shader.uniforms.uArtScale = printUniforms.current.artScale;
      shader.uniforms.uArtOffset = printUniforms.current.artOffset;

      shader.vertexShader =
        `attribute float _facing;
attribute float _printmask;
attribute vec2 _artuv;
attribute float _waistband;
attribute vec2 _rest;
varying vec2 vRest;
varying float vWorldY;
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
  vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
  vLocalY = position.y;`,
        );

      shader.fragmentShader =
        `uniform sampler2D frontMap;
uniform sampler2D backMap;
uniform float hasPrint;
uniform float uShowFaces;
uniform float uPlacket;
uniform float uPlacketTop;
uniform float uClipAboveY;
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
        customProgramCacheKey={() => `garment-print-${showStretch ? 'vc' : 'plain'}`}
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
      <OrbitControls enableDamping dampingFactor={0.08} target={[0, 1.0, 0]} />
    </Canvas>
  );
}
