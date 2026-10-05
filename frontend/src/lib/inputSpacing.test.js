import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeInputSpacing, normalizeSpacingEvent } from './inputSpacing.js'
import { validateAddress } from './addressBook.js'

test('typing and pasted text remove leading and repeated spaces while allowing the next word', () => {
  assert.equal(normalizeInputSpacing('   Nguyen   An '), 'Nguyen An ')
  assert.equal(normalizeInputSpacing('\t\u00a0Nguyen\t\u00a0 An'), 'Nguyen An')
  assert.equal(normalizeInputSpacing('  First  line\n  Next   line'), 'First line\nNext line')
})

test('normalizing an edit preserves the cursor position within text', () => {
  let selection
  const input = { value: ' An  Binh', selectionStart: 5, selectionEnd: 5,
    setSelectionRange: (start, end) => { selection = [start, end] } }
  normalizeSpacingEvent({ currentTarget: input })
  assert.equal(input.value, 'An Binh')
  assert.deepEqual(selection, [3, 3])
})

test('address data is normalized before saving even without input events', () => {
  const address = validateAddress({ name: '  Nguyen   An  ', email: 'an@example.com',
    phone: '0901234567', city: ' Ho  Chi Minh ', address: ' 12   Nguyen Hue ', notes: ' Call  first ' })
  assert.equal(address.name, 'Nguyen An')
  assert.equal(address.city, 'Ho Chi Minh')
  assert.equal(address.address, '12 Nguyen Hue')
  assert.equal(address.notes, 'Call first')
})
