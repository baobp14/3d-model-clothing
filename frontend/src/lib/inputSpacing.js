// Keep one trailing space while typing so users can enter the next word.
// Preserve line breaks in multiline notes.
export function normalizeInputSpacing(value) {
  return String(value).replace(/^[\t\p{Zs}]+/gmu, '').replace(/[\t\p{Zs}]+/gu, ' ')
}

export function normalizeSpacingEvent(event) {
  const input = event.currentTarget
  const before = input.value
  const after = normalizeInputSpacing(before)
  if (before === after) return
  const start = input.selectionStart
  const end = input.selectionEnd
  input.value = after
  if (start !== null && end !== null) {
    input.setSelectionRange(
      normalizeInputSpacing(before.slice(0, start)).length,
      normalizeInputSpacing(before.slice(0, end)).length,
    )
  }
}
