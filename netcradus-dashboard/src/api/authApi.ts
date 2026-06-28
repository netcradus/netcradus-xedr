import type { AuthUser, LoginPayload, SignupPayload, AuthResult } from '@/types/auth.types'
import type { BackendUser } from '@/types/api.types'
import { BASE_URL, apiFetch, setToken, clearToken } from '@/api/client'

const SESSION_KEY = 'netcrad_session'

function mapBackendUser(u: BackendUser): AuthUser {
  const parts = (u.name ?? '').trim().split(' ')
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ') || ''
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'U'
  return {
    id: String(u.id),
    firstName,
    lastName,
    email: u.email,
    company: u.tenant?.name ?? '',
    initials,
    role: u.role?.name ?? 'Viewer',
    emailVerified: u.email_verified ?? false,
  }
}

function saveSession(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function apiLogin(payload: LoginPayload): Promise<AuthResult & { user?: AuthUser }> {
  try {
    const form = new URLSearchParams()
    form.append('username', payload.email)
    form.append('password', payload.password)

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Invalid email or password.' }
    }

    const { access_token } = await res.json()
    setToken(access_token)

    const me = await apiFetch<BackendUser>('/users/me')
    const user = mapBackendUser(me)
    saveSession(user)

    return { success: true, user }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unable to sign in.'
    return { success: false, error: msg }
  }
}

export async function apiSignup(
  payload: SignupPayload
): Promise<AuthResult & { user?: AuthUser; tenantApiKey?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${payload.firstName} ${payload.lastName}`.trim(),
        email: payload.email,
        company: payload.company,
        password: payload.password,
        plan: payload.plan ?? 'Free',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Unable to create account.' }
    }

    const { access_token, tenant_api_key } = await res.json()
    setToken(access_token)

    const me = await apiFetch<BackendUser>('/users/me')
    const user = mapBackendUser(me)
    saveSession(user)

    // Store API key temporarily for the onboarding page
    if (tenant_api_key) {
      sessionStorage.setItem('netcrad_onboarding_key', tenant_api_key)
    }

    return { success: true, user, tenantApiKey: tenant_api_key }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unable to create account.'
    return { success: false, error: msg }
  }
}

export async function apiLogout(): Promise<void> {
  clearToken()
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem('netcrad_onboarding_key')
}

export async function apiForgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Something went wrong.' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error.' }
  }
}

export async function apiResetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Reset failed.' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error.' }
  }
}

export async function apiVerifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Verification failed.' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error.' }
  }
}

export async function apiResendVerification(email: string): Promise<void> {
  await fetch(`${BASE_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}
