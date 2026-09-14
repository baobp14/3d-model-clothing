import type { AvatarBodyInput } from './avatarMorphService';

export type ProfileKey = 'A' | 'B' | 'C';

export const PROFILES: Record<ProfileKey, AvatarBodyInput & { label: string }> = {
  A: {
    label: 'A — slim, 165 cm',
    gender: 'male',
    height: 165,
    weight: 55,
    chest: 86,
    waist: 70,
    hip: 88,
    shoulderWidth: 40,
    armLength: 57,
    inseam: 75,
  },
  B: {
    label: 'B — average, 175 cm',
    gender: 'male',
    height: 175,
    weight: 68,
    chest: 92,
    waist: 78,
    hip: 94,
    shoulderWidth: 44,
    armLength: 60,
    inseam: 81,
  },
  C: {
    label: 'C — large, 185 cm',
    gender: 'male',
    height: 185,
    weight: 90,
    chest: 108,
    waist: 96,
    hip: 108,
    shoulderWidth: 49,
    armLength: 65,
    inseam: 86,
  },
};

export type FemaleProfileKey = 'F1' | 'F2' | 'F3';

/**
 * Female bodies, spread the same way A/B/C are: slim, average, curvy.
 *
 * One female body was not enough to test a garment against. The male set spans
 * 86 to 108 cm of chest and 165 to 185 cm of height, so a shirt gets tried on
 * shapes it fits and shapes it does not; the single female body sat at 86 cm
 * and only ever read as "loose". Hip is the measurement that matters most here
 * and is the one the male set barely varies: F3 is 108 cm at the hip against a
 * 100 cm chest, so the hem has to clear something wider than the chest -- the
 * case a men's block never produces.
 */
export const FEMALE_PROFILES: Record<FemaleProfileKey, AvatarBodyInput & { label: string }> = {
  F1: {
    label: 'F1 — slim, 155 cm',
    gender: 'female',
    height: 155,
    weight: 44,
    chest: 78,
    waist: 60,
    hip: 84,
    shoulderWidth: 35,
    armLength: 52,
    inseam: 70,
  },
  F2: {
    label: 'F2 — average, 162 cm',
    gender: 'female',
    height: 162,
    weight: 52,
    chest: 86,
    waist: 66,
    hip: 92,
    shoulderWidth: 37,
    armLength: 55,
    inseam: 74,
  },
  F3: {
    label: 'F3 — curvy, 170 cm',
    gender: 'female',
    height: 170,
    weight: 74,
    chest: 100,
    waist: 82,
    hip: 108,
    shoulderWidth: 40,
    armLength: 58,
    inseam: 78,
  },
};

/** The average female body. Kept as its own name: it is the default one. */
export const FEMALE_PROFILE = FEMALE_PROFILES.F2;

export const FIELD_LABELS: Record<string, string> = {
  height: 'Height',
  weight: 'Weight',
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip',
  shoulderWidth: 'Shoulder width',
  armLength: 'Arm length',
  inseam: 'Inseam',
  neck: 'Neck',
};

export const FIELD_UNITS: Record<string, string> = {
  height: 'cm',
  weight: 'kg',
  chest: 'cm',
  waist: 'cm',
  hip: 'cm',
  shoulderWidth: 'cm',
  armLength: 'cm',
  inseam: 'cm',
  neck: 'cm',
};

/** Form only asks for 8 fields; neck is optional and not collected here. */
export const FORM_FIELDS = [
  'height',
  'weight',
  'chest',
  'waist',
  'hip',
  'shoulderWidth',
  'armLength',
  'inseam',
] as const;
