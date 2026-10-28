import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { shopApi } from '../lib/api'

const STORAGE_KEY = 'nb_measurements'

export function useMeasurements() {
  const { user } = useAuth()
  const userId = user?.id
  const [measurements, setMeasurements] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(Boolean(userId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!userId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        setMeasurements(raw ? JSON.parse(raw) : null)
      } catch {
        setMeasurements(null)
      }
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await shopApi.request('/account/measurements', { auth: true })
      if (mounted.current) {
        if (data.measurements) {
          setMeasurements(data.measurements)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.measurements)) } catch {}
        } else {
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) setMeasurements(JSON.parse(raw))
          } catch {}
        }
      }
    } catch (err) {
      if (mounted.current) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) setMeasurements(JSON.parse(raw))
        } catch {}
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
    setSaving(true)
    setError('')
    try {
      // Always store locally so guest and offline workflows preserve it immediately
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)) } catch {}

      if (!userId) {
        // Guest mode: update local state without throwing an auth error
        if (mounted.current) {
          setMeasurements(payload)
        }
        return payload
      }

      // Logged-in user: sync to server API
      const data = await shopApi.request('/account/measurements', {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(payload),
      })
      if (mounted.current) {
        setMeasurements(data.measurements)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.measurements)) } catch {}
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
