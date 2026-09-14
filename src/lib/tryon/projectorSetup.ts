/**
 * Pure geometry: frames two virtual "projector" cameras (front/back) around
 * the avatar's neutral body using the same landmarks/positions
 * avatarMorphService.ts already computed. No three.js here on purpose --
 * building the actual THREE.OrthographicCamera + view-projection matrix is
 * projectedGarmentMaterial.ts's job.
 *
 * This is the automatic-framing half of the "dán texture 3D lên mesh"
 * (projected texture mapping) approach: instead of asking the user to
 * calibrate a garment photo by hand, we derive the projector frustum from
 * the avatar's own shoulder/torso landmarks.
 */
import type { MorphRig } from '@/lib/avatar/avatarMorphService';

export interface OrthoProjectorParams {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}

export interface GarmentProjectors {
  front: OrthoProjectorParams;
  back: OrthoProjectorParams;
}

/**
 * Frames the projectors on the avatar's NEUTRAL (zero-axes) body shape.
 * Garment textures stay pinned to this fixed frustum even as the user morphs
 * the body afterwards -- this is a deliberate simplification (see
 * docs/RESEARCH_AI_ECOMMERCE_FASHION.md): the projection is static, not
 * re-fit per body shape, so extreme morphs can make garments look stretched
 * or shifted relative to the skin.
 */
export function computeGarmentProjectors(rig: MorphRig): GarmentProjectors {
  const pos = rig.position;
  const at = (v: number): [number, number, number] => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const acroL = at(rig.landmarks.acromionLeft);
  const acroR = at(rig.landmarks.acromionRight);

  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let v = 0; v < rig.vertexCount; v++) {
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const shoulderWidth = Math.hypot(acroL[0] - acroR[0], acroL[1] - acroR[1], acroL[2] - acroR[2]);
  const bodyHeight = maxY - minY;
  const bodyDepth = Math.max(maxZ - minZ, 0.15);
  const centerZ = (maxZ + minZ) / 2;

  // Vertical frame: a little above the shoulders to a little below the hips
  // -- a torso/top garment region. Horizontal: shoulder width with margin for
  // draped sleeves/hips.
  const top = Math.min(maxY, (acroL[1] + acroR[1]) / 2 + bodyHeight * 0.1);
  const bottom = Math.max(minY, top - bodyHeight * 0.62);
  const midY = (top + bottom) / 2;
  const halfWidth = shoulderWidth * 0.95;
  const halfDepth = Math.max(bodyDepth * 1.6, 0.35);
  const standoff = Math.max(bodyDepth * 2, 0.6);

  const base = {
    up: [0, 1, 0] as [number, number, number],
    left: -halfWidth,
    right: halfWidth,
    top: top - midY,
    bottom: bottom - midY,
    near: standoff - halfDepth,
    far: standoff + halfDepth,
  };

  return {
    front: {
      ...base,
      position: [0, midY, centerZ + standoff],
      target: [0, midY, centerZ],
    },
    back: {
      ...base,
      position: [0, midY, centerZ - standoff],
      target: [0, midY, centerZ],
    },
  };
}
