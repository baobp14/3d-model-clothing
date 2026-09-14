'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import GarmentOverlayMesh from './tryon/GarmentOverlayMesh';
import type { GarmentProjectors } from '@/lib/tryon/projectorSetup';

export type CameraView = 'front' | 'side' | 'back' | 'reset';

// Kept in sync with AvatarTestApp.REFERENCE_HEIGHT_M -- change both together.
export const REFERENCE_HEIGHT_M = 2.0;

interface StudioProps {
  height: number;
}

function Studio({ height: h }: StudioProps) {
  const keyPosition: [number, number, number] = [h * 1.4, h * 2.2, h * 1.6];
  const keyDistance = Math.hypot(...keyPosition);

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#b9b2aa', 0.5]} />
      <directionalLight
        position={keyPosition}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-h * 0.9}
        shadow-camera-right={h * 0.9}
        shadow-camera-top={h * 1.35}
        shadow-camera-bottom={-h * 0.4}
        shadow-camera-near={keyDistance - h}
        shadow-camera-far={keyDistance + h * 1.5}
        shadow-bias={0}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-h * 1.7, h * 1.3, -h * 0.9]} intensity={0.5} />
      <directionalLight position={[0, h * 0.9, -h * 2]} intensity={0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ isBackdrop: true }}>
        <circleGeometry args={[Math.max(h * 3, 4), 64]} />
        <meshStandardMaterial color="#e9e6e2" roughness={1} />
      </mesh>
    </>
  );
}

function fitDistance(fovDeg: number, h: number): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  return (h * 1.18) / 2 / Math.tan(fovRad / 2);
}

function positionFor(view: CameraView, h: number, d: number): [number, number, number] {
  switch (view) {
    case 'front':
      return [0, h * 0.55, d];
    case 'back':
      return [0, h * 0.55, -d];
    case 'side':
      return [d, h * 0.55, 0];
    case 'reset':
    default:
      return [d * 0.42, h * 0.55 * 1.12, d * 0.9];
  }
}

interface CameraRigProps {
  height: number;
  view: CameraView;
  nonce: number;
}

function CameraRig({ height: h, view, nonce }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const goal = useRef<THREE.Vector3 | null>(null);
  const lastNonce = useRef<number>(-1);

  useMemo(() => {
    // recompute the goal whenever view/nonce changes (including re-clicking the same view)
    if (nonce === lastNonce.current) return;
    lastNonce.current = nonce;
    const d = fitDistance((camera as THREE.PerspectiveCamera).fov ?? 35, h);
    const [x, y, z] = positionFor(view, h, d);
    goal.current = new THREE.Vector3(x, y, z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nonce, h]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(new THREE.Vector3(0, h * 0.5, 0), 0.15);
      controls.update();
    }
    if (goal.current) {
      camera.position.lerp(goal.current, 0.15);
      if (camera.position.distanceTo(goal.current) < 0.003) {
        goal.current = null;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={h * 0.25}
      maxDistance={h * 5}
    />
  );
}

interface AvatarCanvasProps {
  object: THREE.Object3D | null;
  height: number;
  view: CameraView;
  viewNonce: number;
  garmentProjectors?: GarmentProjectors | null;
  garmentTorsoMask?: Float32Array | null;
  garmentFrontTexture?: THREE.Texture | null;
  garmentBackTexture?: THREE.Texture | null;
  garmentVisible?: boolean;
}

export default function AvatarCanvas({
  object,
  height,
  view,
  viewNonce,
  garmentProjectors = null,
  garmentTorsoMask = null,
  garmentFrontTexture = null,
  garmentBackTexture = null,
  garmentVisible = false,
}: AvatarCanvasProps) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [1.2, 1.1, 3.2], fov: 35, near: 0.02, far: 60 }}
    >
      <Studio height={height} />
      {object && <primitive object={object} />}
      {object && (
        <GarmentOverlayMesh
          bodyObject={object}
          projectors={garmentProjectors}
          torsoMask={garmentTorsoMask}
          frontTexture={garmentFrontTexture}
          backTexture={garmentBackTexture}
          visible={garmentVisible}
        />
      )}
      <CameraRig height={height} view={view} nonce={viewNonce} />
    </Canvas>
  );
}
