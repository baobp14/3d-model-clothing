import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARRIERS, findCarrier, getTrackingUrl, generateTrackingCode } from './shipping.js'

test('findCarrier matches by id or name', () => {
  assert.equal(findCarrier('GHN')?.id, 'GHN')
  assert.equal(findCarrier('Giao Hàng Tiết Kiệm (GHTK)')?.id, 'GHTK')
  assert.equal(findCarrier('Viettel Post')?.id, 'VTP')
  assert.equal(findCarrier('non-existent'), null)
  assert.equal(findCarrier(null), null)
})

test('getTrackingUrl creates direct tracking links for known carriers', () => {
  const ghnUrl = getTrackingUrl('GHN', 'GHN12345678')
  assert.ok(ghnUrl.includes('tracking.ghn.vn/?order_code=GHN12345678'))

  const ghtkUrl = getTrackingUrl('Giao Hàng Tiết Kiệm (GHTK)', 'S123456')
  assert.ok(ghtkUrl.includes('i.ghtk.vn/S123456'))

  const vtpUrl = getTrackingUrl('VTP', 'VTP99999')
  assert.ok(vtpUrl.includes('viettelpost.vn/tra-cuu-hanh-trinh-don-hang?code=VTP99999'))

  // Fallback to google
  const customUrl = getTrackingUrl('CustomCarrier', 'XYZ999')
  assert.ok(customUrl.includes('google.com/search'))

  assert.equal(getTrackingUrl('GHN', ''), null)
  assert.equal(getTrackingUrl('GHN', null), null)
})

test('generateTrackingCode generates prefixed codes', () => {
  const codeGHN = generateTrackingCode('GHN')
  assert.ok(codeGHN.startsWith('GHN') && codeGHN.length > 5)

  const codeVTP = generateTrackingCode('VTP')
  assert.ok(codeVTP.startsWith('VTP'))
})
