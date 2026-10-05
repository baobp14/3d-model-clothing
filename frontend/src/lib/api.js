import { createApiClient } from './apiClient'
import { supabase } from './supabase'

export const shopApi = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  getSession: () => supabase?.auth.getSession() || Promise.resolve({ error: new Error('NB_AUTH_REQUIRED') }),
})
