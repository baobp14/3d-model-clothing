import { useRef, useState } from 'react'

export default function useSubmission(onError) {
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  return { busy, wrap: (action, validate = () => true) => async event => {
    event.preventDefault()
    if (active.current || !validate()) return
    active.current = true
    setBusy(true)
    try { await action(event) }
    catch { onError() }
    finally { active.current = false; setBusy(false) }
  } }
}
