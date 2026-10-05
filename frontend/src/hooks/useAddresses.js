import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { shopApi } from '../lib/api'
import { addressErrorCode, emptyBook, loadAddressBook, mutateAddressBook } from '../lib/addressBook'

export function useAddresses() {
  const { user } = useAuth()
  const userId = user?.id
  const [state, setState] = useState({ owner: null, book: emptyBook(), loading: true, error: '' })
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const generation = useRef(0)
  const owner = useRef(userId)
  owner.current = userId

  const reload = useCallback(async () => {
    const request = ++generation.current
    setState(current => ({ ...current, loading: true, error: '' }))
    try {
      const book = await loadAddressBook(shopApi, userId)
      if (mounted.current && request === generation.current && owner.current === userId) setState({ owner: userId, book, loading: false, error: '' })
    } catch (error) {
      if (mounted.current && request === generation.current && owner.current === userId) setState({ owner: userId, book: emptyBook(), loading: false, error: addressErrorCode(error) })
    }
  }, [userId])

  useEffect(() => {
    mounted.current = true
    reload()
    return () => { mounted.current = false; generation.current++ }
  }, [reload])

  const book = state.owner === userId ? state.book : emptyBook()
  async function mutate(operation) {
    if (inFlight.current || state.loading || state.error || state.owner !== userId) return null
    inFlight.current = true
    setBusy(true)
    try {
      const result = await mutateAddressBook(shopApi, book, operation)
      if (!mounted.current || owner.current !== userId) return null
      setState({ owner: userId, book: result, loading: false, error: '' })
      return result
    } catch (error) {
      if (!mounted.current || owner.current !== userId) return null
      const code = addressErrorCode(error)
      if (code === 'NB_ADDRESS_CONFLICT' || code === 'NB_ADDRESS_NOT_FOUND') await reload()
      throw new Error(code)
    } finally {
      inFlight.current = false
      if (mounted.current && owner.current === userId) setBusy(false)
    }
  }
  return { book, loading: state.loading || state.owner !== userId, error: state.error, busy, reload, mutate }
}
