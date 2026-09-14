'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createGarmentOverlayMaterial,
  setGarmentTexture,
} from '@/lib/tryon/projectedGarmentMaterial';
import type { GarmentProjectors } from '@/lib/tryon/projectorSetup';

function findMesh(obj: THREE.Object3D | null): THREE.Mesh | null {
  if (!obj) return null;
  let found: THREE.Mesh | null = null;
  obj.traverse((child) => {
    if (!found && (child as THREE.Mesh).isMesh) found = child as THREE.Mesh;
  });
  return found;
}

interface GarmentOverlayMeshProps {
  bodyObject: THREE.Object3D | null;
  projectors: GarmentProjectors | null;
  torsoMask: Float32Array | null;
  frontTexture: THREE.Texture | null;
  backTexture: THREE.Texture | null;
  visible: boolean;
}

/**
 * Renders the "try-on" layer: a mesh sharing the body's own (morphed)
 * geometry, pushed out slightly along its normals, with a projected-texture
 * material that paints the front/back garment photos onto it. Lives inside
 * <Canvas> (needs useFrame/three.js), unlike the rest of AvatarTestApp.
 */
export default function GarmentOverlayMesh({
  bodyObject,
  projectors,
  torsoMask,
  frontTexture,
  backTexture,
  visible,
}: GarmentOverlayMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const bodyMesh = useMemo(() => findMesh(bodyObject), [bodyObject]);

  const material = useMemo(
    () => (projectors ? createGarmentOverlayMaterial(projectors) : null),
    [projectors],
  );

  // Attach the torso mask as a vertex attribute on the SHARED geometry --
  // harmless to the body's own mesh (it uses a plain MeshStandardMaterial
  // that never reads "aTorsoMask"), but required by our shader to clip the
  // overlay to the torso shell instead of painting the whole body.
  useEffect(() => {
    if (!bodyMesh || !torsoMask) return;
    const geometry = bodyMesh.geometry;
    const existing = geometry.getAttribute('aTorsoMask');
    if (existing && existing.array === torsoMask) return;
    geometry.setAttribute('aTorsoMask', new THREE.BufferAttribute(torsoMask, 1));
  }, [bodyMesh, torsoMask]);

  useEffect(() => {
    if (!material) return;
    setGarmentTexture(material, 'front', frontTexture);
  }, [material, frontTexture]);

  useEffect(() => {
    if (!material) return;
    setGarmentTexture(material, 'back', backTexture);
  }, [material, backTexture]);

  useEffect(() => () => material?.dispose(), [material]);

  useFrame(() => {
    const overlay = meshRef.current;
    if (!overlay || !bodyMesh || !bodyMesh.morphTargetInfluences) return;
    const influences = bodyMesh.morphTargetInfluences;
    if (!overlay.morphTargetInfluences || overlay.morphTargetInfluences.length !== influences.length) {
      overlay.morphTargetInfluences = influences.slice();
    } else {
      for (let i = 0; i < influences.length; i++) overlay.morphTargetInfluences[i] = influences[i];
    }
  });

  if (!material || !bodyMesh || !visible) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={bodyMesh.geometry}
      material={material}
      morphTargetDictionary={bodyMesh.morphTargetDictionary}
      renderOrder={10}
    />
  );
}
