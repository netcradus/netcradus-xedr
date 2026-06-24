import type { AuthUser, LoginPayload, SignupPayload, AuthResult } from '@/types/auth.types'

/**
 * Mock auth layer backed by localStorage.
 *
 * This simulates a backend so the rest of the app (routes, store, UI) is
 * written against a realistic async contract. To connect a real backend,
 * replace the bodies of `login`, `signup`, and `logout` below with actual
 * fetch/axios calls to your API — nothing else in the app needs to change.
 */

const USERS_KEY = 'netcrad_users'
const SESSION_KEY = 'netcrad_session'

interface StoredUser extends AuthUser {
  password: string
}

function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function makeInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apiSignup(payload: SignupPayload): Promise<AuthResult & { user?: AuthUser }> {
  await delay()

  const users = getStoredUsers()
  const exists = users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())
  if (exists) {
    return { success: false, error: 'An account with this email already exists.' }
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    company: payload.company,
    password: payload.password,
    initials: makeInitials(payload.firstName, payload.lastName),
  }

  users.push(newUser)
  saveStoredUsers(users)

  const { password, ...user } = newUser
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))

  return { success: true, user }
}

export async function apiLogin(payload: LoginPayload): Promise<AuthResult & { user?: AuthUser }> {
  await delay()

  const users = getStoredUsers()
  const match = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase())

  if (!match || match.password !== payload.password) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const { password, ...user } = match
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))

  return { success: true, user }
}

export async function apiLogout(): Promise<void> {
  await delay(120)
  localStorage.removeItem(SESSION_KEY)
}

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
