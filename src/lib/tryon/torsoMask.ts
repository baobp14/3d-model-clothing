/**
 * Pure per-vertex mask restricting the garment overlay to a torso "shell" --
 * chest/waist/hip band, excluding head, arms/hands, legs and crotch.
 *
 * Why this exists: projecting the garment photo onto the ENTIRE body mesh
 * (see projectorSetup.ts) leaks onto the neck/head (front projector's frame
 * extends above the collar) and onto the outstretched A-pose arms/hands
 * (they sit inside the same XY frustum bounds as the torso at chest height).
 * Rather than build a whole separate garment mesh, we reuse the body's own
 * topology and just mask out the vertices that aren't torso.
 *
 * Calibrated from the same rings/landmarks avatarMorphService.ts already
 * uses, on the NEUTRAL pose -- which body part a vertex belongs to doesn't
 * change as the user morphs the body, only its position does, so a mask
 * computed once here stays valid.
 *
 * The cutoff is a CYLINDER (radius from the torso's own centre axis, which
 * shifts in Z between rings since the chest sits further forward than the
 * back), not a rectangular X-slab -- a slab cutoff followed the body's
 * bounding width, which is jagged exactly at the armpit/side where "torso"
 * and "arm root" are geometrically close together. A radial cutoff hugs the
 * actual torso cross-section instead.
 */
import type { MorphRig } from '@/lib/avatar/avatarMorphService';

interface RingBand {
  y: number;
  centerZ: number;
  radius: number;
}

function ringBand(rig: MorphRig, name: string): RingBand {
  const ring = rig.rings[name];
  let sumY = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of ring) {
    const y = rig.position[v * 3 + 1];
    const z = rig.position[v * 3 + 2];
    sumY += y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const centerZ = (minZ + maxZ) / 2;

  let sumRadius = 0;
  for (const v of ring) {
    const x = rig.position[v * 3];
    const z = rig.position[v * 3 + 2];
    sumRadius += Math.hypot(x, z - centerZ);
  }

  return { y: sumY / ring.length, centerZ, radius: sumRadius / ring.length };
}

export interface TorsoMaskOptions {
  /** Multiplier on the interpolated torso radius before cutting off arms. */
  radiusMargin?: number;
  /** Metres added above the shoulder line (collar allowance). */
  collarMargin?: number;
  /** Metres added below the hip line (hem allowance). */
  hemMargin?: number;
  /** Metres, width of the soft edge blend at every cut boundary. */
  falloff?: number;
}

/**
 * Returns a Float32Array(vertexCount), 1 for "part of the torso shell", 0
 * otherwise, with a soft linear falloff at every boundary.
 */
export function computeTorsoMask(rig: MorphRig, options: TorsoMaskOptions = {}): Float32Array {
  const { radiusMargin = 1.2, collarMargin = 0.04, hemMargin = 0.03, falloff = 0.025 } = options;

  const bands = [ringBand(rig, 'hip'), ringBand(rig, 'waist'), ringBand(rig, 'chest')].sort(
    (a, b) => a.y - b.y,
  );

  const acroL = rig.landmarks.acromionLeft;
  const acroR = rig.landmarks.acromionRight;
  const shoulderY = (rig.position[acroL * 3 + 1] + rig.position[acroR * 3 + 1]) / 2;

  const yTop = shoulderY + collarMargin;
  const yBottom = bands[0].y - hemMargin;

  function interpolate(y: number): { centerZ: number; radius: number } {
    if (y <= bands[0].y) return bands[0];
    const last = bands[bands.length - 1];
    if (y >= last.y) return last;
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i];
      const b = bands[i + 1];
      if (y >= a.y && y <= b.y) {
        const t = (y - a.y) / (b.y - a.y || 1);
        return {
          centerZ: a.centerZ + (b.centerZ - a.centerZ) * t,
          radius: a.radius + (b.radius - a.radius) * t,
        };
      }
    }
    return last;
  }

  const mask = new Float32Array(rig.vertexCount);
  for (let v = 0; v < rig.vertexCount; v++) {
    const x = rig.position[v * 3];
    const y = rig.position[v * 3 + 1];
    const z = rig.position[v * 3 + 2];

    let vMask = 1;
    if (y < yBottom) vMask = 0;
    else if (y < yBottom + falloff) vMask *= (y - yBottom) / falloff;

    if (y > yTop) vMask = 0;
    else if (y > yTop - falloff) vMask *= (yTop - y) / falloff;

    const { centerZ, radius: baseRadius } = interpolate(y);
    const radius = baseRadius * radiusMargin;
    const dist = Math.hypot(x, z - centerZ);
    if (dist > radius) vMask = 0;
    else if (dist > radius - falloff) vMask *= (radius - dist) / falloff;

    mask[v] = Math.max(0, Math.min(1, vMask));
  }

  return mask;
}
