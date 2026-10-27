import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateMeasurements, recommendSize } from './sizeRecommendation.js'

test('estimateMeasurements calculates plausible chest, waist, hips from height and weight', () => {
  const est = estimateMeasurements(175, 68)
  assert.ok(est.chest >= 90 && est.chest <= 100, `Expected chest around 95, got ${est.chest}`)
  assert.ok(est.waist >= 70 && est.waist <= 80, `Expected waist around 75, got ${est.waist}`)
  assert.ok(est.hips >= 85 && est.hips <= 96, `Expected hips around 90, got ${est.hips}`)

  assert.deepEqual(estimateMeasurements(0, 0), {})
  assert.deepEqual(estimateMeasurements(null, undefined), {})
})

test('recommendSize returns null when measurements or sizes are missing', () => {
  assert.equal(recommendSize(), null)
  assert.equal(recommendSize({ measurements: null, availableSizes: ['S', 'M'] }), null)
  assert.equal(recommendSize({ measurements: { chest: 90 }, availableSizes: [] }), null)
})

test('recommendSize picks optimal top size based on chest circumference and chart', () => {
  const chart = {
    kind: 'tshirt',
    sizes: {
      S: { chestCircCm: 92 },
      M: { chestCircCm: 100 },
      L: { chestCircCm: 108 },
    },
  }

  // Customer with 90cm chest, regular fit preference (+10cm target ease -> 100cm garment)
  const recM = recommendSize({
    measurements: { chest: 90, fit_preference: 'regular' },
    sizeChart: chart,
    category: 'Áo thun',
    availableSizes: ['S', 'M', 'L'],
  })
  assert.equal(recM.recommendedSize, 'M')
  assert.equal(recM.fitDescVi, 'vừa vặn')

  // Customer with 86cm chest, slim fit preference (+6cm target ease -> 92cm garment -> S)
  const recS = recommendSize({
    measurements: { chest: 86, fit_preference: 'slim' },
    sizeChart: chart,
    category: 'Áo sơ mi',
    availableSizes: ['S', 'M', 'L'],
  })
  assert.equal(recS.recommendedSize, 'S')

  // Customer with 96cm chest: S is 92cm (too tight, ease < 2), M is 100cm (ease 4), L is 108cm (ease 12).
  // For loose fit preference (+16cm target -> 112cm), L is closest
  const recL = recommendSize({
    measurements: { chest: 96, fit_preference: 'loose' },
    sizeChart: chart,
    category: 'Hoodie',
    availableSizes: ['S', 'M', 'L'],
  })
  assert.equal(recL.recommendedSize, 'L')
})

test('recommendSize picks optimal pants size based on waist circumference', () => {
  const chart = {
    kind: 'pants',
    sizes: {
      S: { waistCircCm: 74 },
      M: { waistCircCm: 80 },
      L: { waistCircCm: 86 },
    },
  }

  const rec = recommendSize({
    measurements: { waist: 77 },
    sizeChart: chart,
    category: 'Quần tây',
    availableSizes: ['S', 'M', 'L'],
  })
  assert.equal(rec.recommendedSize, 'M')
})

test('recommendSize falls back to standard sizes when chart has no measurements', () => {
  const rec = recommendSize({
    measurements: { chest: 95 },
    sizeChart: null,
    category: 'Áo len',
    availableSizes: ['S', 'M', 'L', 'XL'],
  })
  // M standard is 96cm, L is 102cm. Target ease for 95cm regular (+10) = 105cm. L is closest.
  assert.equal(rec.recommendedSize, 'L')
})

test('recommendSize uses estimated measurements when customer only entered height & weight', () => {
  const rec = recommendSize({
    measurements: { height: 172, weight: 65, fit_preference: 'regular' },
    sizeChart: null,
    category: 'Áo thun',
    availableSizes: ['S', 'M', 'L'],
  })
  assert.ok(['M', 'L'].includes(rec.recommendedSize))
})
