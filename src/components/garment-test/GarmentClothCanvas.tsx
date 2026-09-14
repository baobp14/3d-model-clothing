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

export interface ClothViewProps {
  avatar: THREE.Object3D;
  geom: GarmentGeometry;
  constraints: GarmentConstraints;
  colliders: BodyCollider;
  fabric: Fabric;
  spinning: boolean;
  /** Radians per second while spinning. */
  spinSpeed: number;
  /** Bumping this number snaps the body through a half turn. */
  turnNonce: number;
  showStretch: boolean;
  /** Tint the mesh by which print panel each vertex belongs to. */
  showFaces?: boolean;
  wireframe: boolean;
  /** Product photo of the shirt front, background already removed. */
  frontPrint?: THREE.Texture | null;
  /** Product photo of the shirt back. */
  backPrint?: THREE.Texture | null;
  /** Base fabric colour, e.g. sampled from the print so sleeves match. */
  baseColor?: string;
  /** Zoom the print UV about its centre (1 = as unwrapped, >1 = smaller pattern). */
  printScale?: number;
  /** Shift the print UV, in UV units (0.05 ~= a few cm on the shirt). */
  printOffset?: [number, number];
  /** World Y of the morphed body's lowest vertex; the floor disc sits here. */
  groundY?: number;
  /** _REGION id of the ring the garment hangs from (collar=5, waistband=0). */
  pinRegion?: number;
  /** World Y of that ring on the body (shoulder line for a top, waist for trousers). */
  anchorY?: number;
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

function ClothStage({
  avatar,
  geom,
  constraints,
  colliders,
  pinRegion,
  anchorY,
  fabric,
  spinning,
  spinSpeed,
  turnNonce,
  showStretch,
  showFaces = false,
  wireframe,
  frontPrint = null,
  backPrint = null,
  baseColor = '#41599c',
  printScale = 1,
  printOffset = [0, 0],
}: ClothViewProps) {
  const weave = useMemo(makeWeaveBump, []);
  const bodyRef = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const targetYaw = useRef(0);
  const firstTurn = useRef(turnNonce);

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
      printMask[v] = geom.regions[v] === GARMENT_REGION.collar ? 0 : 1;
    }
    g.setAttribute('_printmask', new THREE.BufferAttribute(printMask, 1));

    g.setIndex(new THREE.BufferAttribute(new Uint32Array(geom.indices), 1));
    return g;
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
    yaw.current = 0;
    targetYaw.current = 0;
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
    printUniforms.current.artScale.value = printScale;
    printUniforms.current.artOffset.value.set(printOffset[0], printOffset[1]);
  }, [frontPrint, backPrint, showFaces, showStretch, printScale, printOffset]);

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.frontMap = printUniforms.current.frontMap;
      shader.uniforms.backMap = printUniforms.current.backMap;
      shader.uniforms.hasPrint = printUniforms.current.hasPrint;
      shader.uniforms.uShowFaces = printUniforms.current.showFaces;
      shader.uniforms.uArtScale = printUniforms.current.artScale;
      shader.uniforms.uArtOffset = printUniforms.current.artOffset;

      shader.vertexShader =
        `attribute float _facing;
attribute float _printmask;
attribute vec2 _artuv;
varying float vFacing;
varying float vPrintMask;
varying vec2 vArtUv;
` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vFacing = _facing;
  vPrintMask = _printmask;
  vArtUv = _artuv;`,
        );

      shader.fragmentShader =
        `uniform sampler2D frontMap;
uniform sampler2D backMap;
uniform float hasPrint;
uniform float uShowFaces;
uniform float uArtScale;
uniform vec2 uArtOffset;
varying float vFacing;
varying float vPrintMask;
varying vec2 vArtUv;
` +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
  if (hasPrint > 0.5) {
    // Zoom about the centre, then shift. >1 shows more image = smaller pattern.
    vec2 puv = (vArtUv - 0.5) * uArtScale + 0.5 + uArtOffset;
    vec4 f = texture2D(frontMap, puv);
    vec4 b = texture2D(backMap, vec2(1.0 - puv.x, puv.y));
    vec4 art = mix(b, f, vFacing);
    diffuseColor.rgb = mix(diffuseColor.rgb, art.rgb, art.a * vPrintMask);
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

  useEffect(() => {
    if (turnNonce === firstTurn.current) return;
    firstTurn.current = turnNonce;
    targetYaw.current += Math.PI;
  }, [turnNonce]);

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

    if (spinning) targetYaw.current += spinSpeed * dt;
    // Ease toward the target so a snap turn is fast but not instantaneous --
    // an instantaneous jump gives the cloth infinite velocity and it explodes.
    // Rate 7 was tuned on the old 1.7k procedural mesh; on the body-derived
    // one it threw the shoulders out far enough that they did not settle back.
    yaw.current += (targetYaw.current - yaw.current) * Math.min(1, dt * 3);

    if (bodyRef.current) bodyRef.current.rotation.y = yaw.current;
    live.current.yaw = yaw.current;
    setBodyYaw(sim, yaw.current);

    // Two substeps only while the body is actually turning. One 60 Hz step is
    // enough for a hanging shirt; the second exists so the hem cannot tunnel
    // through the hips during a fast turn. Paying for it while the model
    // stands still doubled the cost of the most common frame for nothing.
    const turning = Math.abs(targetYaw.current - yaw.current) > 0.002 || spinning;
    if (turning) {
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
    <>
      {/* Wireframe hides the body: when the question is whether the garment
          mesh has a hole, the body is exactly what gets in the way of seeing
          it. */}
      <group ref={bodyRef} visible={!wireframe}>
        <primitive object={avatar} />
      </group>
      <mesh geometry={geometry} castShadow>
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
      <ClothStage {...props} />
      <OrbitControls enableDamping dampingFactor={0.08} target={[0, 1.0, 0]} />
    </Canvas>
  );
}
