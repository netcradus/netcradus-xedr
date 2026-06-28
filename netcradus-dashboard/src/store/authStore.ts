import { create } from 'zustand'
import type { AuthUser, LoginPayload, SignupPayload } from '@/types/auth.types'
import { apiLogin, apiLogout, apiSignup, getSession } from '@/api/authApi'

type MfaPending = { mfaRequired: true; mfaSession: string }

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (payload: LoginPayload) => Promise<boolean | MfaPending>
  signup: (payload: SignupPayload) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getSession(),
  isAuthenticated: Boolean(getSession()),
  isLoading: false,
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null })
    const result = await apiLogin(payload)

    if (result.mfaRequired && result.mfaSession) {
      set({ isLoading: false })
      return { mfaRequired: true, mfaSession: result.mfaSession }
    }

    if (result.success && result.user) {
      set({ user: result.user, isAuthenticated: true, isLoading: false, error: null })
      return true
    }

    set({ isLoading: false, error: result.error ?? 'Unable to sign in.' })
    return false
  },

  signup: async (payload) => {
    set({ isLoading: true, error: null })
    const result = await apiSignup(payload)
    if (result.success && result.user) {
      set({ user: result.user, isAuthenticated: true, isLoading: false, error: null })
      return true
    }
    set({ isLoading: false, error: result.error ?? 'Unable to create account.' })
    return false
  },

  logout: async () => {
    await apiLogout()
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),
}))
