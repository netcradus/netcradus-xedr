export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  company: string
  initials: string
  role?: string
  emailVerified?: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  firstName: string
  lastName: string
  email: string
  company: string
  password: string
  plan?: string
}

export interface AuthResult {
  success: boolean
  error?: string
}
