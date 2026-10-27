import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { shopApi } from '../lib/api'

export function useMeasurements() {
  const { user } = useAuth()
  const userId = user?.id
  const [measurements, setMeasurements] = useState(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!userId) {
      setMeasurements(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await shopApi.request('/account/measurements')
      if (mounted.current) {
        setMeasurements(data.measurements || null)
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Failed to load measurements')
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  const save = useCallback(async (payload) => {
    if (!userId) throw new Error('NB_AUTH_REQUIRED')
    setSaving(true)
    setError('')
    try {
      const data = await shopApi.request('/account/measurements', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (mounted.current) {
        setMeasurements(data.measurements)
      }
      return data.measurements
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Failed to save measurements')
      }
      throw err
    } finally {
      if (mounted.current) setSaving(false)
    }
  }, [userId])

  return { measurements, loading, saving, error, reload: load, save }
}
