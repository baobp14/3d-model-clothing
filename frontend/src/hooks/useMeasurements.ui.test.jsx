import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor, act } from '@testing-library/react'
import { useMeasurements } from './useMeasurements'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))

let mockUser = { id: 'user-abc-123' }
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))

describe('useMeasurements hook loop test', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    request.mockReset()
    mockUser = { id: 'user-abc-123' }
  })

  it('logged in: loads from API with auth:true and saves with auth:true', async () => {
    const serverData = { height: 175, weight: 65, chest: 96, waist: 78, hips: 94, shoulder: 44, fit_preference: 'regular' }
    request.mockImplementation(async (path, opts) => {
      if (path === '/account/measurements' && opts?.method === 'PUT') {
        expect(opts.auth).toBe(true)
        const parsed = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body
        return { measurements: parsed }
      }
      expect(opts?.auth).toBe(true)
      return { measurements: serverData }
    })

    const { result } = renderHook(() => useMeasurements())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.measurements?.chest).toBe(96)
    })

    // Verify localStorage was synced
    const local = JSON.parse(localStorage.getItem('nb_measurements'))
    expect(local.chest).toBe(96)

    // Save update
    let updated
    await act(async () => {
      updated = await result.current.save({ ...serverData, chest: 100 })
    })

    expect(updated.chest).toBe(100)
    expect(result.current.measurements.chest).toBe(100)
    expect(JSON.parse(localStorage.getItem('nb_measurements')).chest).toBe(100)
  })

  it('guest mode: saves to localStorage without throwing auth error', async () => {
    mockUser = null // Guest user

    const { result } = renderHook(() => useMeasurements())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.measurements).toBeNull()
    })

    const guestData = { height: 170, weight: 58, chest: 90, waist: 72, hips: 88, shoulder: 42, fit_preference: 'slim' }

    await act(async () => {
      const res = await result.current.save(guestData)
      expect(res.chest).toBe(90)
    })

    expect(result.current.measurements.chest).toBe(90)
    expect(JSON.parse(localStorage.getItem('nb_measurements')).chest).toBe(90)
    // Server API should NOT be called in guest mode
    expect(request).not.toHaveBeenCalled()
  })

  it('guest mode: reloads previously saved measurements from localStorage', async () => {
    mockUser = null
    const stored = { height: 168, weight: 52, chest: 86, waist: 66, hips: 90, shoulder: 40, fit_preference: 'regular' }
    localStorage.setItem('nb_measurements', JSON.stringify(stored))

    const { result } = renderHook(() => useMeasurements())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.measurements?.chest).toBe(86)
    })
  })
})
