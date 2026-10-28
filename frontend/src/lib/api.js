import { createApiClient } from './apiClient'
import { supabase } from './supabase'

export const shopApi = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  getSession: async () => {
    try {
      const live = await supabase?.auth.getSession()
      if (live?.data?.session?.access_token) return live
    } catch { /* ignore */ }
    if (import.meta.env.DEV && typeof window !== 'undefined' && (localStorage.getItem('nb_dev_role') === 'admin' || localStorage.getItem('nb_role') === 'admin')) {
      return {
        data: {
          session: {
            access_token: 'dev-admin-token',
            user: { id: '4698b0f47c5b4abd842dbdc789b779b1', email: 'admin@nb-atelier.vn', app_metadata: { role: 'admin' } }
          }
        }
      }
    }
    return { error: new Error('NB_AUTH_REQUIRED') }
  },
})
