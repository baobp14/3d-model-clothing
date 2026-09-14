'use client';

import * as THREE from 'three';
import type { GarmentProjectors, OrthoProjectorParams } from './projectorSetup';

function buildProjectorCamera(params: OrthoProjectorParams): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(
    params.left,
    params.right,
    params.top,
    params.bottom,
    params.near,
    params.far,
  );
  camera.position.set(...params.position);
  camera.up.set(...params.up);
  camera.lookAt(new THREE.Vector3(...params.target));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function viewProjectionMatrix(camera: THREE.OrthographicCamera): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

function projectorDirection(params: OrthoProjectorParams): THREE.Vector3 {
  const p = new THREE.Vector3(...params.position);
  const t = new THREE.Vector3(...params.target);
  return p.sub(t).normalize();
}

interface GarmentUniforms {
  frontMap: { value: THREE.Texture | null };
  backMap: { value: THREE.Texture | null };
  hasFrontMap: { value: boolean };
  hasBackMap: { value: boolean };
  frontMatrix: { value: THREE.Matrix4 };
  backMatrix: { value: THREE.Matrix4 };
  frontDir: { value: THREE.Vector3 };
  overlayOffset: { value: number };
}

/**
 * Projected-texture ("decal") material: samples the front/back garment
 * photos as if they were slide-projected onto the body from two fixed
 * orthographic cameras, blending between them by surface-normal facing.
 * This is a real-time graphics technique (no learned model, no GPU
 * inference) -- see docs/RESEARCH_AI_ECOMMERCE_FASHION.md for how this
 * compares to AI-generated (diffusion) virtual try-on.
 */
export function createGarmentOverlayMaterial(projectors: GarmentProjectors): THREE.MeshStandardMaterial {
  const frontCam = buildProjectorCamera(projectors.front);
  const backCam = buildProjectorCamera(projectors.back);

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0,
    transparent: true,
    depthWrite: true,
  });
  // Morph target support is auto-detected by the renderer from
  // geometry.morphAttributes.position -- no material flag needed in this
  // three.js version.
  material.side = THREE.FrontSide;

  // Created up-front (not inside onBeforeCompile) so setGarmentTexture() can
  // mutate `.value` at any time -- including before the material's first
  // compile -- and have it take effect once compilation does happen, since
  // three.js binds the shader's uniforms object by reference.
  const uniforms: GarmentUniforms = {
    frontMap: { value: null },
    backMap: { value: null },
    hasFrontMap: { value: false },
    hasBackMap: { value: false },
    frontMatrix: { value: viewProjectionMatrix(frontCam) },
    backMatrix: { value: viewProjectionMatrix(backCam) },
    frontDir: { value: projectorDirection(projectors.front) },
    overlayOffset: { value: 0.006 },
  };
  material.userData.garmentUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aTorsoMask;
varying vec3 vGarmentWorldPos;
varying vec3 vGarmentWorldNormal;
varying float vGarmentMask;
uniform float overlayOffset;`,
      )
      .replace(
        '#include <morphtarget_vertex>',
        `#include <morphtarget_vertex>
		vGarmentWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
		vGarmentWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
		vGarmentMask = aTorsoMask;
		transformed += objectNormal * overlayOffset * aTorsoMask;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vGarmentWorldPos;
varying vec3 vGarmentWorldNormal;
varying float vGarmentMask;
uniform sampler2D frontMap;
uniform sampler2D backMap;
uniform bool hasFrontMap;
uniform bool hasBackMap;
uniform mat4 frontMatrix;
uniform mat4 backMatrix;
uniform vec3 frontDir;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
		{
			if (vGarmentMask < 0.02) discard;

			vec4 frontClip = frontMatrix * vec4(vGarmentWorldPos, 1.0);
			vec3 frontNdc = frontClip.xyz / max(frontClip.w, 1e-6);
			vec2 frontUv = frontNdc.xy * 0.5 + 0.5;
			bool frontInside = hasFrontMap && frontClip.w > 0.0
				&& all(greaterThanEqual(frontNdc, vec3(-1.0))) && all(lessThanEqual(frontNdc, vec3(1.0)));
			vec4 frontSample = frontInside ? texture2D(frontMap, frontUv) : vec4(0.0);

			vec4 backClip = backMatrix * vec4(vGarmentWorldPos, 1.0);
			vec3 backNdc = backClip.xyz / max(backClip.w, 1e-6);
			vec2 backUv = backNdc.xy * 0.5 + 0.5;
			bool backInside = hasBackMap && backClip.w > 0.0
				&& all(greaterThanEqual(backNdc, vec3(-1.0))) && all(lessThanEqual(backNdc, vec3(1.0)));
			vec4 backSample = backInside ? texture2D(backMap, backUv) : vec4(0.0);

			// Narrow blend band: a wide one made the shoulder curve show a
			// double-exposed mix of both photos (reported as "ảnh chồng lên
			// nhau ở vai"). Facing is ambiguous only in a thin strip at the
			// side silhouette, so keep the transition tight.
			float facing = dot(normalize(vGarmentWorldNormal), frontDir);
			float frontWeight = smoothstep(-0.06, 0.06, facing);
			vec4 blended = mix(backSample, frontSample, frontWeight);
			float alpha = blended.a * vGarmentMask;
			if (alpha < 0.04) discard;
			diffuseColor = vec4(blended.rgb, alpha);
		}`,
      );

    material.userData.shader = shader;
  };

  return material;
}

export function setGarmentTexture(
  material: THREE.MeshStandardMaterial,
  slot: 'front' | 'back',
  texture: THREE.Texture | null,
): void {
  const uniforms = material.userData.garmentUniforms as GarmentUniforms | undefined;
  if (!uniforms) return;
  if (slot === 'front') {
    uniforms.frontMap.value = texture;
    uniforms.hasFrontMap.value = !!texture;
  } else {
    uniforms.backMap.value = texture;
    uniforms.hasBackMap.value = !!texture;
  }
}
