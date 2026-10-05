import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  isSupabaseReady: true, clearRecoveryMarker: vi.fn(), getRecoverySessionId: () => null,
  supabase: { auth: {
    getSession: async () => ({ data: { session: { user: { id: 'customer', email: 'customer@example.com' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signOut: logout,
  } },
}))
function Account() {
  const { user, loading, signOut } = useAuth()
  return <><p>{loading ? 'loading' : user?.email || 'signed out'}</p><button onClick={() => signOut().catch(() => {})}>Sign out</button></>
}
afterEach(() => { cleanup(); logout.mockReset() })
it('a rejected logout retains the signed-in account instead of reporting success', async () => {
  logout.mockResolvedValue({ error: new Error('offline') })
  render(<AuthProvider><Account /></AuthProvider>)
  await screen.findByText('customer@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce())
  expect(screen.getByText('customer@example.com')).toBeTruthy()
  expect(screen.queryByText('signed out')).toBe(null)
})
it('successful logout clears the account', async () => {
  logout.mockResolvedValue({ error: null })
  render(<AuthProvider><Account /></AuthProvider>)
  await screen.findByText('customer@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByText('signed out')
})
