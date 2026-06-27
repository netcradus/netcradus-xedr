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

export async function apiSignup(payload: SignupPayload): Promise<AuthResult & { user?: AuthUser }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${payload.firstName} ${payload.lastName}`.trim(),
        email: payload.email,
        password: payload.password,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.detail ?? 'Unable to create account.' }
    }

    return apiLogin({ email: payload.email, password: payload.password })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unable to create account.'
    return { success: false, error: msg }
  }
}

export async function apiLogout(): Promise<void> {
  clearToken()
  localStorage.removeItem(SESSION_KEY)
}
