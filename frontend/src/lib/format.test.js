import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, formatVnd } from './format.js'

// Intl dùng khoảng trắng không ngắt (U+00A0) giữa số và ký hiệu tiền
const nbsp = value => value.replace(/ /g, ' ')

test('formats VND the Vietnamese way: grouped digits, symbol after, no decimals', () => {
  assert.equal(nbsp(formatVnd(35000000)), '35.000.000 ₫')
  assert.equal(nbsp(formatVnd(250000)), '250.000 ₫')
  assert.equal(nbsp(formatVnd(0)), '0 ₫')
  assert.equal(nbsp(formatVnd(1999.6)), '2.000 ₫')
})

test('accepts numeric strings from the API and never prints NaN', () => {
  assert.equal(nbsp(formatVnd('100000')), '100.000 ₫')
  assert.equal(nbsp(formatVnd(undefined)), '0 ₫')
  assert.equal(nbsp(formatVnd('abc')), '0 ₫')
})

test('formatPrice is the same formatter for existing callers', () => {
  assert.equal(formatPrice, formatVnd)
})
