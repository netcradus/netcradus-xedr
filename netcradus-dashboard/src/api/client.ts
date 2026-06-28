export const BASE_URL = 'http://127.0.0.1:8000'

const TOKEN_KEY = 'netcrad_token'
const SESSION_KEY = 'netcrad_session'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
}

// Prevents multiple concurrent refresh attempts
let _refreshing: Promise<boolean> | null = null

async function _tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',    // send refresh_token httpOnly cookie
    })
    if (!res.ok) return false
    const { access_token } = await res.json()
    setToken(access_token)
    return true
  } catch {
    return false
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',   // required so httpOnly refresh cookie is sent
  })

  // On 401: attempt silent token refresh then retry once
  if (res.status === 401) {
    if (!_refreshing) {
      _refreshing = _tryRefresh().finally(() => { _refreshing = null })
    }
    const refreshed = await _refreshing
    if (refreshed) {
      const newToken = getToken()
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
      const retry = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: retryHeaders,
        credentials: 'include',
      })
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ detail: retry.statusText }))
        throw new Error(err.detail ?? 'Request failed')
      }
      return retry.json() as Promise<T>
    }
    // Refresh failed — force logout
    clearToken()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json() as Promise<T>
}
