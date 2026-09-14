'use client';

// Puts the background-removed cutout onto the real shirt mesh, worn by a body.
//
// This is the same 3D shirt renderer the garment page uses, loaded with one
// fixed body (F2, average female) and one fixed size (M). The point here is
// not to try sizes -- that is the garment page's job -- it is to answer "does
// this cutout read right as a print once it is on a shirt that moves", which
// a flat 2D matte cannot show.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  axesToInfluences,
  createMorphRig,
  solveAxes,
  type AvatarMetadata,
} from '@/lib/avatar/avatarMorphService';
import { FEMALE_PROFILES } from '@/lib/avatar/bodyProfiles';
import {
  blobToTexture,
  trimToContent,
  averageOpaqueColor,
} from '@/lib/tryon/backgroundRemoval';
import {
  buildBodyCollider,
  buildConstraints,
  FABRICS,
  type BodyCollider,
  type GarmentConstraints,
  type GarmentGeometry,
} from '@/lib/tryon/garmentFit';
import GarmentClothCanvas from '@/components/garment-test/GarmentClothCanvas';

const PROFILE = FEMALE_PROFILES.F2;
const SIZE = 'M';

interface Scene {
  avatar: THREE.Object3D;
  geom: GarmentGeometry;
  constraints: GarmentConstraints;
  colliders: BodyCollider;
  printScale: number;
  printOffset: [number, number];
}

export default function Tryon3DPreview({ cutout }: { cutout: Blob | null }) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [baseColor, setBaseColor] = useState('#41599c');
  const [spinning, setSpinning] = useState(false);

  // Turn the cutout blob into a texture whenever it changes.
  useEffect(() => {
    let dead = false;
    if (!cutout) {
      setTex(null);
      setBaseColor('#41599c');
      return;
    }
    // Trim the transparent margin first: the shirt UV is 0..1 across the whole
    // silhouette, so an untrimmed photo lands as a small patch in the middle.
    (async () => {
      const trimmed = await trimToContent(cutout);
      const [t, color] = await Promise.all([
        blobToTexture(trimmed),
        averageOpaqueColor(trimmed),
      ]);
      if (dead) return;
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
      setBaseColor(color);
    })();
    return () => {
      dead = true;
    };
  }, [cutout]);

  // Load the body and shirt once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loader = new GLTFLoader();
        const metaRes = await fetch('/models/avatar-metadata.json');
        if (!metaRes.ok) throw new Error('avatar-metadata.json — chạy npm run avatar:build');
        const metadata: AvatarMetadata = await metaRes.json();

        const gltf = await loader.loadAsync(`/models/avatar-${PROFILE.gender}.glb`);
        let body: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!body && (o as THREE.Mesh).isMesh) body = o as THREE.Mesh;
        });
        if (!body) throw new Error('avatar glb: không có mesh');
        const bg = (body as THREE.Mesh).geometry;
        const morphs = bg.morphAttributes.position;
        if (!morphs) throw new Error('avatar glb: không có morph target');
        const rig = createMorphRig(
          {
            position: bg.attributes.position.array as Float32Array,
            morphDeltas: morphs.map((a) => a.array as Float32Array),
          },
          metadata,
          PROFILE.gender,
        );

        const gMetaRes = await fetch('/models/garment-metadata.json');
        if (!gMetaRes.ok) throw new Error('garment-metadata.json — chạy npm run garment:build');
        const gMeta = await gMetaRes.json();

        const gGltf = await loader.loadAsync('/models/garment-tshirt.glb');
        let shirtMesh: THREE.Mesh | null = null;
        gGltf.scene.traverse((o) => {
          const mm = o as THREE.Mesh;
          if (!shirtMesh && mm.isMesh && mm.name === `tshirt_${SIZE}`) shirtMesh = mm;
        });
        if (!shirtMesh) throw new Error(`garment glb: không có tshirt_${SIZE}`);
        const sm = shirtMesh as THREE.Mesh;
        const facing = sm.geometry.getAttribute('_facing');
        const region = sm.geometry.getAttribute('_region');
        const geom: GarmentGeometry = {
          positions: sm.geometry.attributes.position.array as Float32Array,
          indices: sm.geometry.index!.array as Uint32Array,
          regions: region.array as Uint8Array,
          uv: sm.geometry.attributes.uv.array as Float32Array,
          artUv: sm.geometry.getAttribute('_artuv')?.array as Float32Array | undefined,
          facing: Float32Array.from(facing.array as ArrayLike<number>, (v) =>
            facing.normalized ? v / 255 : v,
          ),
        };
        const garment = {
          geom,
          constraints: buildConstraints(geom, gMeta.sizes[SIZE]?.seams ?? []),
        };

        const solved = solveAxes(rig, PROFILE);
        const influences = axesToInfluences(rig, solved.axes);
        const mesh = body as THREE.Mesh;
        mesh.morphTargetInfluences = Array.from(influences);
        const collider = buildBodyCollider(rig, influences, mesh.geometry.index!.array);
        collider.yaw = 0;

        const cal = gMeta.printCalibration ?? { scale: 1, offsetX: 0, offsetY: 0 };

        if (cancelled) return;
        setScene({
          avatar: gltf.scene,
          geom: garment.geom,
          constraints: garment.constraints,
          colliders: collider,
          printScale: cal.scale,
          printOffset: [cal.offsetX ?? 0, cal.offsetY],
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnNonce = useRef(0);

  const canvas = useMemo(() => {
    if (!scene) return null;
    return (
      <GarmentClothCanvas
        avatar={scene.avatar}
        geom={scene.geom}
        constraints={scene.constraints}
        colliders={scene.colliders}
        fabric={FABRICS.knit}
        spinning={spinning}
        spinSpeed={1.4}
        turnNonce={turnNonce.current}
        showStretch={false}
        wireframe={false}
        frontPrint={tex}
        backPrint={null}
        baseColor={baseColor}
        printScale={scene.printScale}
        printOffset={scene.printOffset}
      />
    );
  }, [scene, tex, baseColor, spinning]);

  if (error) {
    return <div className="p-6 text-sm text-red-600">Lỗi: {error}</div>;
  }
  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-400">
        Đang tải người mẫu và mesh áo…
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {canvas}
      <div className="absolute left-3 top-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => setSpinning((v) => !v)}
          className="rounded border border-stone-300 bg-white/90 px-2.5 py-1 text-xs text-stone-700 hover:bg-white"
        >
          {spinning ? 'Dừng quay' : 'Quay người'}
        </button>
      </div>
      {!tex && (
        <div className="absolute inset-x-0 bottom-3 text-center text-xs text-stone-400">
          Chưa có ảnh — tách nền một ảnh áo để dán lên.
        </div>
      )}
    </div>
  );
}
