import { useEffect, useState } from 'react'

export function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (value === settled) return
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay, settled])
  return settled
}
