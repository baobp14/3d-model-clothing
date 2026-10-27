/**
 * Smart size recommendation based on customer measurements and garment charts.
 */

export const EASE_TARGETS = {
  slim: 6,
  regular: 10,
  loose: 16,
}

export function estimateMeasurements(height, weight) {
  if (!height || !weight) return {}
  const h = Number(height)
  const w = Number(weight)
  if (h <= 0 || w <= 0) return {}
  // Anthropometric estimation
  const chest = Math.round((w * 1.12 + (h - 160) * 0.22 + 16) * 10) / 10
  const waist = Math.round((w * 0.92 + (h - 160) * 0.12 + 10) * 10) / 10
  const hips = Math.round((waist + 16) * 10) / 10
  const shoulder = Math.round((h * 0.25) * 10) / 10
  return { chest, waist, hips, shoulder }
}

const STANDARD_TOP_CHEST = {
  XS: 84,
  S: 90,
  M: 96,
  L: 102,
  XL: 108,
  XXL: 114,
  '2XL': 114,
  '3XL': 120,
}

const STANDARD_BOTTOM_WAIST = {
  XS: 68,
  S: 72,
  M: 78,
  L: 84,
  XL: 90,
  XXL: 96,
  '2XL': 96,
  '3XL': 102,
  // Numeric waist sizes (inches -> cm)
  '28': 71,
  '29': 74,
  '30': 76,
  '31': 79,
  '32': 81,
  '33': 84,
  '34': 86,
  '35': 89,
  '36': 91,
}

function isBottomCategory(category = '') {
  const norm = String(category).toLowerCase()
  return norm.includes('quần') || norm.includes('pants') || norm.includes('jeans') || norm.includes('shorts') || norm.includes('skirt') || norm.includes('váy')
}

export function recommendSize({ measurements, sizeChart, category = '', availableSizes = [] } = {}) {
  if (!measurements || !availableSizes || availableSizes.length === 0) return null

  const height = Number(measurements.height) || 0
  const weight = Number(measurements.weight) || 0
  const estimated = (height && weight) ? estimateMeasurements(height, weight) : {}

  const bodyChest = Number(measurements.chest) || estimated.chest
  const bodyWaist = Number(measurements.waist) || estimated.waist
  const bodyHips = Number(measurements.hips) || estimated.hips
  const fitPref = measurements.fit_preference || 'regular'
  const targetEase = EASE_TARGETS[fitPref] ?? EASE_TARGETS.regular

  const isBottom = isBottomCategory(category) || sizeChart?.kind === 'pants' || sizeChart?.kind === 'shorts' || sizeChart?.kind === 'skirt'

  if (isBottom) {
    if (!bodyWaist && !bodyHips) return null
    return pickBestBottomSize({
      bodyWaist,
      bodyHips,
      targetEase: targetEase * 0.4, // bottoms have less ease than tops
      fitPref,
      sizeChart,
      availableSizes,
    })
  }

  // Tops (tshirts, shirts, jackets...)
  if (!bodyChest) return null
  return pickBestTopSize({
    bodyChest,
    targetEase,
    fitPref,
    sizeChart,
    availableSizes,
  })
}

function pickBestTopSize({ bodyChest, targetEase, fitPref, sizeChart, availableSizes }) {
  let bestSize = null
  let minScore = Infinity
  let bestDetails = null

  for (const size of availableSizes) {
    const chartSize = sizeChart?.sizes?.[size]
    const garmentChest = chartSize?.chestCircCm ?? STANDARD_TOP_CHEST[size.toUpperCase()]

    if (garmentChest == null) continue

    const ease = garmentChest - bodyChest
    // Negative ease or ease < 2cm means tight/cannot zip comfortably
    let penalty = 0
    if (ease < 2) {
      penalty = (2 - ease) * 50 + 200 // heavy penalty
    } else {
      penalty = Math.abs(ease - targetEase)
    }

    if (penalty < minScore) {
      minScore = penalty
      bestSize = size
      bestDetails = { garmentChest, ease }
    }
  }

  if (!bestSize) return null

  const ease = bestDetails.ease
  let fitDescVi = 'vừa vặn'
  let fitDescEn = 'regular fit'
  if (ease < 5) {
    fitDescVi = 'ôm sát'
    fitDescEn = 'slim/snug fit'
  } else if (ease > 14) {
    fitDescVi = 'rộng rãi'
    fitDescEn = 'relaxed fit'
  }

  return {
    recommendedSize: bestSize,
    ease: Math.round(ease * 10) / 10,
    fitDescVi,
    fitDescEn,
    reasonVi: `Dựa trên vòng ngực ${Math.round(bodyChest)}cm · ${fitDescVi}`,
    reasonEn: `Based on your chest ${Math.round(bodyChest)}cm · ${fitDescEn}`,
  }
}

function pickBestBottomSize({ bodyWaist, bodyHips, targetEase, fitPref, sizeChart, availableSizes }) {
  let bestSize = null
  let minScore = Infinity
  let bestDetails = null

  for (const size of availableSizes) {
    const chartSize = sizeChart?.sizes?.[size]
    const garmentWaist = chartSize?.waistCircCm ?? STANDARD_BOTTOM_WAIST[size] ?? STANDARD_BOTTOM_WAIST[size.toUpperCase()]

    if (garmentWaist == null) continue

    const ease = garmentWaist - bodyWaist
    let penalty = 0
    if (ease < 0) {
      penalty = (0 - ease) * 50 + 200
    } else {
      penalty = Math.abs(ease - targetEase)
    }

    if (penalty < minScore) {
      minScore = penalty
      bestSize = size
      bestDetails = { garmentWaist, ease }
    }
  }

  if (!bestSize) return null

  const ease = bestDetails.ease
  let fitDescVi = 'vừa vặn'
  let fitDescEn = 'regular fit'
  if (ease < 2) {
    fitDescVi = 'ôm vừa eo'
    fitDescEn = 'snug waist'
  } else if (ease > 6) {
    fitDescVi = 'thoải mái'
    fitDescEn = 'comfortable waist'
  }

  return {
    recommendedSize: bestSize,
    ease: Math.round(ease * 10) / 10,
    fitDescVi,
    fitDescEn,
    reasonVi: `Dựa trên vòng eo ${Math.round(bodyWaist)}cm · ${fitDescVi}`,
    reasonEn: `Based on your waist ${Math.round(bodyWaist)}cm · ${fitDescEn}`,
  }
}
